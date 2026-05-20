/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LogLevel } from '@azure/msal-browser';

/**
 * Configuration object to be passed to MSAL instance on creation. 
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md 
 */

export const msalConfig = {
    auth: {
        clientId: '<your-client-id-here>', // This is the ONLY mandatory field that you need to supply.
        authority: 'https://<your-tenant-name>.ciamlogin.com/', // Replace the placeholder with your tenant subdomain 
        redirectUri: '/',
        postLogoutRedirectUri: '/',
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: 'sessionStorage', // Configures cache location. "sessionStorage" is more secure, but "localStorage" gives you SSO between tabs.
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        return;
                }
            },
        },
    },
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit: 
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
const claimsRequestValue = {
    "id_token": {
    "amr": {
        "essential": true,
        "values": ["ngcmfa"]
        }
    },
    access_token: {
        amr: {
            essential: true,
            values: ['ngcmfa']
        }
    }
};
const claims = JSON.stringify(claimsRequestValue);
export const loginRequest = {
    scopes: [],
    // Add following claims to enforce ngcmfa, which means every 15 minutes, user needs to re-authenticate with MFA in order to perform passkey creation/deletion operations.
    // This also trigger passkey during sign-in if user already has passkey registered, as passkey could be a default authentication method with highest priority.
    // Currently, for CIAM tenant, autofill with passkey as first authentication method is supported. Using passkey as a secondary auth method is not supported.
    extraQueryParameters: {
        claims: claims,
    },
};


/**
 * Application configuration consumed by the SPA at runtime.
 */
export const appConfig = {
    proxyDomain: 'http://localhost:3001/api',
    appId: 'your-client-id',
    tenantId: 'your-tenant-id',
    customDomain: '', // Optional: your valid custom domain. If empty, the tenant subdomain from creationOptions.rp.id is used.
};