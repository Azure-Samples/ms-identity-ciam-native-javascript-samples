import { selfServiceApiConfig } from '../authConfig';

const ACQUIRE_AFTER_SIGN_IN_KEY = 'acquire_self_service_token_after_sign_in';

function selfServiceTokenRequest(account) {
    if (!account) {
        throw new Error('Sign in before requesting a Self Service API access token');
    }

    return {
        account,
        authority: selfServiceApiConfig.exchangeAuthority,
        scopes: [selfServiceApiConfig.scope],
        claims: selfServiceApiConfig.claims,
        redirectUri: selfServiceApiConfig.exchangeRedirectUri,
    };
}

/** Schedule one silent Self Service API token acquisition after re-sign-in completes. */
export function requestSelfServiceTokenAfterSignIn() {
    sessionStorage.setItem(ACQUIRE_AFTER_SIGN_IN_KEY, 'true');
}

/** Check whether token acquisition was requested for the current sign-in redirect. */
export function isSelfServiceTokenAcquisitionAfterSignInPending() {
    return sessionStorage.getItem(ACQUIRE_AFTER_SIGN_IN_KEY) === 'true';
}

/** Renew the Self Service API token once after re-sign-in without another redirect. */
export async function acquireSelfServiceTokenAfterSignIn(instance, account) {
    if (!isSelfServiceTokenAcquisitionAfterSignInPending()) {
        return;
    }

    sessionStorage.removeItem(ACQUIRE_AFTER_SIGN_IN_KEY);
    await getSelfServiceAccessToken(instance, account, true);
}

/** Get a delegated Self Service API token, letting MSAL renew it when needed. */
export async function getSelfServiceAccessToken(instance, account, forceRefresh = false) {
    const result = await instance.acquireTokenSilent({
        ...selfServiceTokenRequest(account),
        forceRefresh,
    });
    return result.accessToken;
}

/** Start interactive Self Service API authorization when user action is required. */
export async function redirectForSelfServiceAccess(instance, account) {
    await instance.acquireTokenRedirect({
        ...selfServiceTokenRequest(account),
        loginHint: account.username,
    });
}
