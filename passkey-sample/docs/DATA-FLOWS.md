# Data Flows

This document shows the **runtime behaviour** of `passkey-sample` as sequence
diagrams. Read [ARCHITECTURE.md](./ARCHITECTURE.md) first for the static
structure and the two‑token model.

Participants used below:

* **Browser/UI** — React components (`SecurityPage`, `PasskeysSection`, sub‑components)
* **Hooks** — `useAuthentication`, `usePasskeyFetcher`, `usePasskeyAddOperation`, `usePasskeyDeleteOperation`
* **PasskeyService / GraphApiClient** — service layer
* **MSAL** — `@azure/msal-react` / `msal-browser`
* **Proxy** — `cors.js`
* **Entra** — `login.microsoftonline.com` token endpoint
* **Graph** — `graph.microsoft.com/beta` fido2Methods
* **WebAuthn** — `navigator.credentials` (browser authenticator / YubiKey)

---

## 1. App start‑up & sign‑in

```mermaid
sequenceDiagram
    participant Browser
    participant idx as index.jsx
    participant MSAL
    participant App as App.jsx / PageLayout
    participant Nav as NavigationBar

    Browser->>idx: load page
    idx->>MSAL: new PublicClientApplication(msalConfig)
    idx->>MSAL: initialize() + handleRedirectPromise()
    MSAL-->>idx: redirect response (if returning from login)
    idx->>MSAL: setActiveAccount(account)
    idx->>App: render <App instance=msal />
    alt Unauthenticated
        App->>Nav: show "Sign in"
        Nav->>MSAL: loginRedirect({ ...loginRequest, prompt:'login' })
        MSAL->>Browser: redirect to Entra (requests ngcmfa claim)
    else Authenticated
        App->>App: render <SecurityPage/>
    end
```

`loginRequest` carries the `ngcmfa` amr claim so the resulting token proves a
recent MFA — this is what later gates passkey changes.

---

## 2. Token acquisition (SecurityPage on mount)

`SecurityPage` acquires **both** tokens and derives the user id + MFA expiry.

```mermaid
sequenceDiagram
    participant Sec as SecurityPage
    participant Tok as tokenUtils
    participant MSAL
    participant Proxy as cors.js
    participant Entra

    Note over Sec: useEffect #1 — user access token
    Sec->>Tok: getAccessToken(instance, accounts, loginRequest)
    Tok->>MSAL: acquireTokenSilent({ claims: ngcmfa })
    alt MFA expired (invalid_grant)
        Tok->>MSAL: acquireTokenRedirect(...)
        MSAL-->>Sec: (redirect to Entra)
    else success
        MSAL-->>Tok: access token
        Tok-->>Sec: { decodedToken }  (oid, iat, name, email)
    end

    Note over Sec: useEffect #2 — app (client-credentials) token
    Sec->>Tok: getCachedAppToken(instance, proxyDomain, appId, VITE_APP_SECRET)
    alt cached & valid
        Tok-->>Sec: cached appToken
    else fetch new
        Tok->>Proxy: POST /api/oauth2/v2.0/token (client_credentials)
        Proxy->>Entra: forward to login.microsoftonline.com/{tenantId}
        Entra-->>Proxy: access_token
        Proxy-->>Tok: access_token
        Tok->>Tok: cache in session/localStorage (exp - 5 min)
        Tok-->>Sec: appToken
    end

    Note over Sec: useEffect #3 — derive NGCMFA expiry
    Sec->>Tok: calculateNgcmfaExpiration(decodedToken, 15)
    Tok-->>Sec: ngcmfaExpiration = iat + 15min
    Sec->>Sec: pass appToken, userId(oid), ngcmfaExpiry → PasskeysSection
```

Key point: the **user token** yields `userId` (`oid`) and the **MFA expiry**; the
**app token** is the Bearer used for all Graph calls.

---

## 3. Fetch passkeys (initial load & refresh)

```mermaid
sequenceDiagram
    participant PSec as PasskeysSection
    participant Fetch as usePasskeyFetcher
    participant Svc as PasskeyService
    participant MA as MyAccountApiClient
    participant MyAcct as My Account API
    participant GSU as graphServiceUtils

    PSec->>Fetch: fetchPasskeys()  (on appToken+userId ready)
    Fetch->>Svc: fetchUserPasskey(token, userId)
    Svc->>MA: myAccountGet('/me/methods', token)
    Note over MA: adds Content-Type: application/hal+json,<br/>Allow: GET, Bearer token,<br/>hardcoded dc + myaccessgrpccanary params
    MA->>MyAcct: GET /{tenantId}/api/v1.0/me/methods?dc=…&myaccessgrpccanary=true
    MyAcct-->>MA: HAL+JSON { _embedded.methods: [...] }
    MA-->>Svc: response
    Svc->>GSU: transformFido2Methods(response)
    Note over GSU: reads _embedded.methods, keeps type==="fido",<br/>maps id/name/type/attestationLevel/aaGuid/links
    GSU-->>Svc: UI passkey models
    Svc-->>Fetch: passkeys[]
    Fetch->>Fetch: setPasskeys / setIsLoading(false)
    Fetch-->>PSec: state → PasskeysList renders
```

> **Migration note:** the list/GET now targets the **My Account API**
> (`login.microsoftonline.com/{tenantId}/api/v1.0/me/methods`) via
> `MyAccountApiClient`. The add/delete flows below still use Microsoft Graph and
> will be migrated in later steps.

`usePasskeyFetcher` also supports an **expected‑change** mode used after add/delete:
it retries (`MAX_RETRIES`, backoff) until the list reflects the change, smoothing
over API propagation delay.

---

## 4. Add passkey (with MFA gate + WebAuthn)

```mermaid
sequenceDiagram
    participant Hdr as PasskeysHeader
    participant Add as usePasskeyAddOperation
    participant Auth as useAuthentication
    participant Svc as PasskeyService
    participant WA as WebAuthn
    participant GC as GraphApiClient
    participant Graph
    participant Fetch as usePasskeyFetcher

    Hdr->>Add: handleAddPasskey()
    Add->>Auth: isTokenExpired(ngcmfaExpiry)?
    alt MFA expired
        Add->>Auth: cacheOperation({action:'add'})
        Add->>Auth: handleReAuthentication() → toast "Next"
        Note right of Auth: user clicks → loginRedirect → returns to step 2 flow,<br/>then resumes via cached operation (see §6)
    else MFA valid
        Add->>Svc: getPasskeyCreationOptions(appToken, userId)
        Svc->>GC: graphGet(.../creationOptions(challengeTimeoutInMinutes=60))
        GC->>Graph: GET creationOptions
        Graph-->>Svc: publicKey creation options
        Add->>Svc: registerUserPasskey(creationOptions, appToken, userId)
        Svc->>WA: navigator.credentials.create({ publicKey })
        WA-->>Svc: PublicKeyCredential (attestation)
        Svc->>GC: graphPost(.../fido2Methods, { publicKeyCredential, displayName })
        GC->>Graph: POST fido2Methods
        Graph-->>Svc: 201 Created
        Add->>Fetch: fetchPasskeys({type:'add', expectedCount+1})
        Fetch-->>Hdr: updated list + success toast
    end
```

Notes:
* `createCredential` decodes `excludeCredentials` ids and base64url‑encodes the
  challenge/user id before calling WebAuthn; the attestation is re‑encoded to
  base64url for Graph.
* A user‑cancelled / timed‑out ceremony throws `NotAllowedError`, surfaced as a
  friendly "operation cancelled" toast.

---

## 5. Delete passkey (with MFA gate + confirm modal)

```mermaid
sequenceDiagram
    participant Item as PasskeyItem
    participant Del as usePasskeyDeleteOperation
    participant Auth as useAuthentication
    participant Modal as DeleteModal
    participant Svc as PasskeyService
    participant GC as GraphApiClient
    participant Graph
    participant Fetch as usePasskeyFetcher

    Item->>Del: initiate(passkey)
    Del->>Auth: isTokenExpired(ngcmfaExpiry)?
    alt MFA expired
        Del->>Auth: cacheOperation({action:'delete', passkey})
        Del->>Auth: handleReAuthentication() (resume after redirect, §6)
    else MFA valid
        Del->>Modal: show confirmation (modalProps)
        Modal->>Del: onConfirm()
        Del->>Svc: deleteUserPasskey(appToken, userId, passkeyId)
        Svc->>GC: graphDelete(.../fido2Methods/{passkeyId})
        GC->>Graph: DELETE fido2Methods/{id}
        Graph-->>Svc: 204 No Content
        Del->>Fetch: fetchPasskeys({type:'delete', passkeyId})
        Fetch-->>Item: updated list + success toast
    end
```

---

## 6. Re‑authentication & resuming a cached operation

When the MFA gate trips, the intended operation is stored and replayed after the
interactive sign‑in returns, so the user doesn't have to click twice.

```mermaid
sequenceDiagram
    participant Hook as Add/Delete hook
    participant Auth as useAuthentication
    participant SS as sessionStorage
    participant MSAL
    participant PSec as PasskeysSection (after reload)

    Hook->>Auth: cacheOperation(op)
    Auth->>SS: setItem('postLoginAction', op)
    Auth->>MSAL: loginRedirect({ loginHint })  (clears app-token cache)
    MSAL-->>PSec: redirect back, app re-renders, tokens refreshed (§2)
    PSec->>Auth: getCachedOperation()
    Auth->>SS: getItem('postLoginAction')
    SS-->>PSec: { action:'add' | 'delete', passkey? }
    Auth->>SS: removeItem('postLoginAction')
    alt action == 'add'
        PSec->>Hook: performAddPasskey()   (skips gate, MFA now fresh)
    else action == 'delete'
        PSec->>Hook: showConfirmationModal(passkey)
    end
```

---

## 7. Toast notifications (cross‑cutting)

All user feedback flows through a single queue owned by `SecurityPage`:

```mermaid
flowchart LR
    Hooks["hooks (add/delete/fetch/auth)"] -- onShowToast(msg) --> Sec["SecurityPage.showToast"]
    Util["passkeyUtils.createToastMessages.*"] -- builds msg --> Hooks
    Sec --> Queue["toasts[] state"]
    Queue --> TN["ToastNotifications"]
    TN --> Regular["top-right toasts"]
    TN --> Center["centered MFA 'Next' toast"]
```

`createToastMessages` is the single source of toast copy (success, error,
session‑expired‑with‑action, etc.), keeping messaging consistent across hooks.
