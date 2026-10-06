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
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
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

/**
 * Get application token using client credentials flow
 * @param {string} proxyDomain - Proxy domain URL
 * @param {string} appId - Application ID
 * @param {string} appSecret - Application secret
 * @returns {Promise<string|null>} - App token or null if failed
 */
export const getAppToken = async (proxyDomain, appId, appSecret) => {
    try {
        const tokenEndpoint = `${proxyDomain}/oauth2/v2.0/token`;

        const params = new URLSearchParams();
        params.append('client_id', appId);
        params.append('client_secret', appSecret);
        params.append('grant_type', 'client_credentials');
        params.append('scope', 'https://graph.microsoft.com/.default');

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error acquiring app token:', error);
        return null;
    }
};

/**
 * Get cached application token using MSAL browser storage
 * @param {Object} instance - MSAL instance
 * @param {string} proxyDomain - Proxy domain URL
 * @param {string} appId - Application ID
 * @param {string} appSecret - Application secret
 * @returns {Promise<string|null>} - App token or null if failed
 */
export const getCachedAppToken = async (instance, proxyDomain, appId, appSecret) => {
    const cacheKey = 'app_token_cache';
    
    const storage = instance.getConfiguration().cache.cacheLocation === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;
    
    try {
        const cached = storage.getItem(cacheKey);
        if (cached) {
            const { token, expiresAt } = JSON.parse(cached);
            if (Date.now() < expiresAt) {
                console.log('Using cached app token');
                return token;
            } else {
                console.log('Cached app token expired, removing from cache');
                storage.removeItem(cacheKey);
            }
        }
        
        console.log('Fetching new app token');
        const newToken = await getAppToken(proxyDomain, appId, appSecret);
        
        if (newToken) {
            const decodedToken = parseJwt(newToken);
            let expiresAt = Date.now() + (3600 * 1000);
            
            if (decodedToken && decodedToken.exp) {
                expiresAt = (decodedToken.exp * 1000) - (5 * 60 * 1000);
            }
            
            storage.setItem(cacheKey, JSON.stringify({
                token: newToken,
                expiresAt: expiresAt,
                fetchedAt: Date.now()
            }));
            
            console.log('App token cached until:', new Date(expiresAt));
        }
        
        return newToken;
    } catch (error) {
        console.error('Error with cached app token:', error);
        storage.removeItem(cacheKey);
        return await getAppToken(proxyDomain, appId, appSecret);
    }
};

/**
 * Clear cached application token from MSAL browser storage
 * @param {Object} instance - MSAL instance
 */
export const clearAppTokenCache = (instance) => {
    const cacheKey = 'app_token_cache';
    const storage = instance.getConfiguration().cache.cacheLocation === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;
    
    storage.removeItem(cacheKey);
    console.log('App token cache cleared');
};
