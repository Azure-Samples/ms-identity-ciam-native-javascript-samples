/**
 * Token utility functions for JWT parsing and token management
 */
import { routingQueryParameters } from '../authConfig';
import { withDcParameter } from './requestRouting.js';

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
 * @param {boolean} forceRefresh - Whether to bypass the access-token cache
 * @returns {Promise<Object>} - Object containing { token, decodedToken, error }
 */
export const getAccessToken = async (instance, accounts, loginRequest, forceRefresh = false) => {
    if (accounts.length > 0) {
        const request = {
            ...loginRequest,
            claims: loginRequest.extraQueryParameters?.claims,
            account: accounts[0],
            forceRefresh,
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
 * @returns {Promise<string>} - Application access token
 * @throws {Error} - Configuration or token acquisition error
 */
export const getAppToken = async (proxyDomain, appId, appSecret) => {
    try {
        if (typeof appSecret !== 'string' || !appSecret.trim()) {
            throw new Error('Set VITE_APP_SECRET to a valid client secret value for the configured app registration.');
        }
        const tokenEndpoint = withDcParameter(`${proxyDomain}/oauth2/v2.0/token`, routingQueryParameters.dc);

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

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error_description || data.error || `HTTP error! status: ${response.status}`);
        }
        if (typeof data.access_token !== 'string' || !data.access_token.trim()) {
            throw new Error('Application token endpoint returned no access token.');
        }
        return data.access_token;
    } catch (error) {
        console.error('Error acquiring app token:', error);
        throw error;
    }
};

/**
 * Get cached application token using MSAL browser storage
 * @param {Object} instance - MSAL instance
 * @param {string} proxyDomain - Proxy domain URL
 * @param {string} appId - Application ID
 * @param {string} appSecret - Application secret
 * @returns {Promise<string>} - Application access token
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
            const claims = parseJwt(token);
            const hasApplicationRoles = !claims || (Array.isArray(claims.roles) && claims.roles.length > 0);
            if (typeof token === 'string' && token.trim() && Date.now() < expiresAt && hasApplicationRoles) {
                console.log('Using cached app token');
                return token;
            } else {
                console.log('Cached app token expired or unusable, removing from cache');
                storage.removeItem(cacheKey);
            }
        }
    } catch (error) {
        console.warn('Could not read the application token cache; requesting a fresh token:', error);
    }

    console.log('Fetching new app token');
    const newToken = await getAppToken(proxyDomain, appId, appSecret);
    const decodedToken = parseJwt(newToken);
    const expiresAt = decodedToken?.exp
        ? (decodedToken.exp * 1000) - (5 * 60 * 1000)
        : Date.now() + (3600 * 1000);

    try {
        storage.setItem(cacheKey, JSON.stringify({
            token: newToken,
            expiresAt,
            fetchedAt: Date.now()
        }));
    } catch (error) {
        console.warn('Could not cache the application token:', error);
    }

    return newToken;
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
