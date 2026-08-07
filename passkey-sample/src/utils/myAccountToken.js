/**
 * Mints the access token (token B) the credential-management SDK uses to call
 * the My Account API.
 *
 * Two-app FOCI exchange: the user signs into the SPA app (56d7c325...). We read
 * that sign-in's family refresh token out of the MSAL cache and redeem it at the
 * CIAM tenant token endpoint as a DIFFERENT client (exchangeClientId, 57e36946...)
 * — the app pre-authorized to call the My Account API — carrying the
 * registersecurityinfo + ngcmfa step-up claims. The resulting token B has
 * appid = exchangeClientId and aud = the My Account API resource.
 *
 * The sign-in app and the exchange app must belong to the same FOCI family so
 * the family refresh token is redeemable by the exchange client_id.
 *
 * TEST-ONLY: reading refresh tokens out of the MSAL cache and POSTing the
 * exchange by hand is a local-harness hack. Do not ship this.
 */

import { credentialApiConfig } from '../authConfig';
import { parseJwt } from './tokenUtils';
import { CredentialManagementRequestSetupError, ErrorCodes } from '@azure/msal-credential-management-browser';

const TOKEN_CACHE_KEY = 'my_account_api_token';
// Refresh token B this many seconds before it actually expires.
const EXPIRY_SKEW_SECONDS = 60;

/**
 * AADSTS error code returned by the token endpoint when the refresh token's MFA
 * context is older than the tenant's ngcmfa policy window and MFA must be redone.
 */
const AADSTS_MFA_EXPIRED = 50078;

/**
 * Stable sentinel embedded in the exchange error message when AADSTS50078 is
 * detected. The SDK flattens a failing `tokenProvider` down to its message only
 * (see CredentialMethodsApiRequestBuilder.acquireToken), so this sentinel is how
 * the structured "must redo MFA" signal survives to the UI layer.
 */
const NGCMFA_REQUIRED_SENTINEL = 'ngcmfa_required';

/**
 * The storage MSAL-browser writes its cache into. authConfig sets
 * cacheLocation: 'sessionStorage'.
 * @returns {Storage}
 */
function getMsalStorage() {
    return window.sessionStorage;
}

/**
 * Scan the MSAL cache for a refresh token usable by the exchange client.
 *
 * MSAL stores each credential as a JSON blob keyed by a compound key. For FOCI
 * apps it stores a single *family* refresh token (familyId '1', clientId '1')
 * that any family member can redeem — that's the one the exchange needs. We
 * prefer the family token and fall back to a token bound to the sign-in client.
 * @returns {string|null} The refresh token secret, or null if none found.
 */
function readRefreshToken() {
    const storage = getMsalStorage();
    let familyToken = null;
    let clientToken = null;
    const seen = [];

    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key || key.indexOf('refreshtoken') === -1) {
            continue;
        }
        let entry;
        try {
            entry = JSON.parse(storage.getItem(key));
        } catch {
            continue;
        }
        if (!entry || entry.credentialType !== 'RefreshToken' || !entry.secret) {
            continue;
        }
        seen.push({ clientId: entry.clientId, familyId: entry.familyId || null });
        // Family refresh token (foci) — redeemable by the exchange client.
        if (entry.familyId) {
            familyToken = entry.secret;
        } else {
            clientToken = entry.secret;
        }
    }

    // Diagnostic: which RTs are in the cache and whether a family (FOCI) token
    // exists. A cross-client exchange (sign-in app -> exchange app) needs a
    // family token; if only app-bound tokens exist, redemption returns 70000.
    console.debug('[myAccountToken] refresh tokens in cache:', seen,
        '| using:', familyToken ? 'FAMILY (foci)' : (clientToken ? 'APP-BOUND' : 'NONE'));

    return familyToken || clientToken;
}

/**
 * Read a previously exchanged, still-valid token B from sessionStorage.
 * @returns {string|null}
 */
function readCachedToken() {
    try {
        const raw = getMsalStorage().getItem(TOKEN_CACHE_KEY);
        if (!raw) {
            return null;
        }
        const { token, exp } = JSON.parse(raw);
        const now = Math.floor(Date.now() / 1000);
        if (token && exp && exp - EXPIRY_SKEW_SECONDS > now) {
            return token;
        }
    } catch {
        // fall through to a fresh exchange
    }
    return null;
}

/**
 * Cache token B keyed by its own exp claim.
 * @param {string} token
 */
function cacheToken(token) {
    const decoded = parseJwt(token);
    const exp = decoded && decoded.exp ? decoded.exp : Math.floor(Date.now() / 1000) + 300;
    try {
        getMsalStorage().setItem(TOKEN_CACHE_KEY, JSON.stringify({ token, exp }));
    } catch {
        // best-effort cache only
    }
}

/**
 * Redeem the refresh token at the CIAM tenant token endpoint as the exchange
 * client, requesting the My Account API scope with step-up claims.
 * @param {string} refreshToken
 * @returns {Promise<string>} access token B
 */
async function exchangeRefreshToken(refreshToken) {
    const url = `${credentialApiConfig.exchangeAuthority}/oauth2/v2.0/token?dc=${encodeURIComponent(
        credentialApiConfig.dc
    )}`;

    // Step-up claims are REQUIRED so token B carries acrs=registersecurityinfo +
    // amr=ngcmfa; without them the My Account API rejects passkey register/delete.
    // Guard explicitly so a missing/empty config can never silently send
    // "claims=undefined" — surface it as a clear configuration error instead.
    const claims = credentialApiConfig.claims;
    if (!claims || typeof claims !== 'string') {
        throw new Error(
            'My Account token exchange is missing required step-up claims (credentialApiConfig.claims).'
        );
    }

    const body = new URLSearchParams({
        client_id: credentialApiConfig.exchangeClientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: credentialApiConfig.scope,
        claims,
    });
    // redirect_uri is NOT required for a refresh_token grant. Sending a value
    // that isn't a registered redirect URI triggers AADSTS50011, so only include
    // it if explicitly configured (and then it must EXACTLY match a redirect URI
    // registered on the app the refresh token belongs to).
    if (credentialApiConfig.exchangeRedirectUri) {
        body.set('redirect_uri', credentialApiConfig.exchangeRedirectUri);
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    const data = await response.json();
    if (!response.ok || !data.access_token) {
        const detail = data.error_description || data.error || response.statusText;
        // Detect the "MFA expired, must re-authenticate" case from the STRUCTURED
        // error_codes array (AADSTS50078) rather than string-matching the human
        // description. Prefix the message with a stable sentinel so the SDK-typed
        // error that reaches the UI can be classified without re-parsing AADSTS
        // text (see isNgcmfaReauthRequired).
        const codes = Array.isArray(data.error_codes) ? data.error_codes : [];
        if (codes.includes(AADSTS_MFA_EXPIRED)) {
            throw new Error(`${NGCMFA_REQUIRED_SENTINEL}: ${detail}`);
        }
        throw new Error(`My Account token exchange failed: ${detail}`);
    }
    return data.access_token;
}

/**
 * Clear the cached exchanged token B. Call this when the API/exchange reports
 * that MFA must be redone (AADSTS50078): the cached token may still be within
 * its `exp` but its MFA context is stale, so it must be discarded to force a
 * fresh exchange after re-authentication.
 */
export function clearCachedMyAccountApiToken() {
    try {
        getMsalStorage().removeItem(TOKEN_CACHE_KEY);
    } catch {
        // best-effort only
    }
}

/**
 * Get an access token for the My Account credential API. Intended to be passed
 * as the SDK's `tokenProvider`.
 * @returns {Promise<string>} Access token B
 */
export async function getMyAccountApiToken() {
    const cached = readCachedToken();
    if (cached) {
        return cached;
    }

    const refreshToken = readRefreshToken();
    if (!refreshToken) {
        throw new Error(
            'No refresh token found in the MSAL cache. Sign in before calling the credential API.'
        );
    }

    const token = await exchangeRefreshToken(refreshToken);
    cacheToken(token);
    return token;
}

/**
 * Classify an error thrown from a credential-management SDK call (register /
 * list / delete) as the "MFA expired, re-authentication required" (AADSTS50078)
 * condition.
 *
 * Uses the SDK's typed error model: when the `tokenProvider` throws, the SDK
 * surfaces a CredentialManagementRequestSetupError with errorCode `invalid_token`
 * (ErrorCodes.InvalidToken). Because the SDK preserves only the message, the
 * actual 50078 detection is done at the source via the structured error_codes
 * array (see exchangeRefreshToken) and carried through as a stable sentinel that
 * this function checks — not raw AADSTS text.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isNgcmfaReauthRequired(err) {
    if (err instanceof CredentialManagementRequestSetupError) {
        return (
            err.errorCode === ErrorCodes.InvalidToken &&
            typeof err.message === 'string' &&
            err.message.includes(NGCMFA_REQUIRED_SENTINEL)
        );
    }
    // Exchange error surfaced directly (e.g. getMyAccountApiToken called outside
    // the SDK tokenProvider path).
    return typeof err?.message === 'string' && err.message.includes(NGCMFA_REQUIRED_SENTINEL);
}
