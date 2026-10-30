/**
 * Token utility functions for JWT parsing and token management
 */

/**
 * Decode JWT token
 * @param {string} token - JWT token to decode
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
export const parseJwt = (token) => {
    try {
        if (!token || typeof token !== 'string') {
            return null;
        }
        const base64Url = token.split('.')[1];
        if (!base64Url) {
            // Not a JWT (e.g. an opaque/encrypted access token) — nothing to decode.
            return null;
        }
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        // atob requires the input length to be a multiple of 4; base64url
        // strips the '=' padding, so restore it before decoding.
        const padding = base64.length % 4;
        if (padding) {
            base64 += '='.repeat(4 - padding);
        }
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        if (!jsonPayload) {
            return null;
        }
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return null;
    }
};

/**
 * Get access token from MSAL instance
 * @param {Object} instance - MSAL instance
 * @param {Array} accounts - User accounts
 * @param {Object} tokenRequest - Token request configuration
 * @param {boolean} forceRefresh - Whether to bypass the access-token cache
 * @returns {Promise<Object>} - Object containing { token, decodedToken, error }
 */
export const getAccessToken = async (instance, accounts, loginRequest, forceRefresh = false) => {
    if (accounts.length > 0) {
        const request = {
            claims: loginRequest.extraQueryParameters?.claims,
            account: accounts[0],
            forceRefresh,
        };

        try {
            console.log('Account found for token request');
            const response = await instance.acquireTokenSilent(request);
            console.log('Page access token expiry:', {
                expiresOn: response.expiresOn?.toISOString() ?? null,
                secondsRemaining: response.expiresOn
                    ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000)
                    : null,
                fromCache: response.fromCache,
                forceRefresh,
            });
            const decodedToken = parseJwt(response.accessToken);
            console.log('Access token acquired successfully');

            return {
                token: response.accessToken,
                decodedToken: decodedToken,
                error: null
            };
        } catch (error) {
            console.error('Error acquiring access token:', error);
            if (error.errorCode === 'invalid_grant' && error.message.includes('multi-factor authentication has expired')) {
            // Force interactive authentication for MFA expiry
                return await instance.acquireTokenRedirect(request);
            }
            return {
                token: null,
                decodedToken: null,
                error: 'Failed to acquire access token. This might be because the token is not available or has expired. Please re-sign in.'
            };
        }
    } else {
        // No accounts found - redirect to login
        try {
            await instance.loginRedirect(loginRequest);
            return { token: null, decodedToken: null, error: 'Redirecting to login...' };
        } catch (loginError) {
            return { token: null, decodedToken: null, error: 'No account found' };
        }
    }
};
