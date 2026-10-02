import { credentialApiConfig } from '../authConfig';

const ACQUIRE_AFTER_SIGN_IN_KEY = 'acquire_my_account_token_after_sign_in';

function myAccountTokenRequest(account) {
    if (!account) {
        throw new Error('Sign in before requesting a My Account access token');
    }

    return {
        account,
        authority: credentialApiConfig.exchangeAuthority,
        scopes: [credentialApiConfig.scope],
        claims: credentialApiConfig.claims,
        redirectUri: credentialApiConfig.exchangeRedirectUri,
    };
}

/** Schedule one silent My Account token acquisition after re-sign-in completes. */
export function requestMyAccountTokenAfterSignIn() {
    sessionStorage.setItem(ACQUIRE_AFTER_SIGN_IN_KEY, 'true');
}

/** Check whether token acquisition was requested for the current sign-in redirect. */
export function isTokenAcquisitionAfterSignInPending() {
    return sessionStorage.getItem(ACQUIRE_AFTER_SIGN_IN_KEY) === 'true';
}

/** Renew the My Account token once after re-sign-in without starting another redirect. */
export async function acquireMyAccountTokenAfterSignIn(instance, account) {
    if (!isTokenAcquisitionAfterSignInPending()) {
        return;
    }

    sessionStorage.removeItem(ACQUIRE_AFTER_SIGN_IN_KEY);
    await getMyAccountAccessToken(instance, account, true);
}

/** Get a delegated My Account access token, letting MSAL renew it when needed. */
export async function getMyAccountAccessToken(instance, account, forceRefresh = false) {
    const result = await instance.acquireTokenSilent({
        ...myAccountTokenRequest(account),
        forceRefresh,
    });
    return result.accessToken;
}

/** Start interactive authorization if silent acquisition requires user action. */
export async function redirectForMyAccountAccess(instance, account) {
    await instance.acquireTokenRedirect({
        ...myAccountTokenRequest(account),
        loginHint: account.username,
    });
}
