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
 * Calculate NGCMFA expiration using token iat + specified minutes
 * @param {Object} decodedToken - Decoded JWT token
 * @param {number} expiryMinutes - Minutes to add to iat (default: 10)
 * @param {number} secondsPerMinute - Seconds per minute (default: 60)
 * @returns {number|null} - Expiration timestamp or null if invalid
 */
export const calculateNgcmfaExpiration = (decodedToken, expiryMinutes = 10, secondsPerMinute = 60) => {
    if (decodedToken && decodedToken.iat) {
        const expiration = decodedToken.iat + (expiryMinutes * secondsPerMinute);
        console.log('NGCMFA expiration calculated:', expiration, 'Token iat:', decodedToken.iat, 'Current time:', Math.floor(Date.now() / 1000));
        return expiration;
    }
    return null;
};

/**
 * Get access token from MSAL instance
 * @param {Object} instance - MSAL instance
 * @param {Array} accounts - User accounts
 * @param {Object} tokenRequest - Token request configuration
 * @returns {Promise<Object>} - Object containing { token, decodedToken, error }
 */
export const getAccessToken = async (instance, accounts, loginRequest) => {
    if (accounts.length > 0) {
        const request = {
            claims: loginRequest.extraQueryParameters?.claims,
            account: accounts[0],
        };

        try {
            console.log('Account found for token request');
            const response = await instance.acquireTokenSilent(request);
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
