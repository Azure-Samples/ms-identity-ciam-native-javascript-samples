import { credentialApiConfig } from '../authConfig';

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
    await instance.acquireTokenRedirect(myAccountTokenRequest(account));
}
