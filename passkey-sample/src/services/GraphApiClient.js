/**
 * Generic HTTP client for Microsoft Graph API
 * Handles authentication, error parsing, and common request patterns
 */

import { routingQueryParameters } from '../authConfig';
import { withDcParameter } from '../utils/requestRouting.js';

const msGraphDomain = "graph.microsoft.com/beta";

/**
 * Parse Microsoft Graph API error responses with nested JSON structure
 * @param {Response} response - Fetch response object
 * @throws {Error} - Formatted error with detailed message
 */
export async function parseGraphApiError(response) {
    const text = await response.text();
    let errorJson;
    try {
        errorJson = JSON.parse(text);
    } catch {
        throw new Error(`HTTP ${response.status}: ${text || 'Empty API error response'}`);
    }

    const graphError = errorJson?.error;
    let errorMessage = graphError?.code || `HTTP ${response.status}`;
    if (graphError?.message) {
        let detail = graphError.message;
        try {
            const nestedError = JSON.parse(detail);
            detail = nestedError?.["odata.error"]?.message?.value || detail;
        } catch {
            // Graph normally returns the message as plain text.
        }
        errorMessage = `${errorMessage}: ${detail}`;
    }
    throw new Error(errorMessage);
}

/**
 * Make a request to Microsoft Graph API with standardized error handling
 * @param {string} endpoint - API endpoint path (e.g., '/users/123/authentication/fido2Methods')
 * @param {Object} options - Fetch options object
 * @param {string} options.method - HTTP method (GET, POST, DELETE, etc.)
 * @param {Object} options.headers - Additional headers
 * @param {string} options.body - Request body (JSON string)
 * @param {string} appToken - Bearer token for authentication
 * @returns {Promise<Response>} - Fetch response object
 * @throws {Error} - Formatted error if request fails
 */
export async function makeGraphRequest(endpoint, options = {}, appToken) {
    if (typeof appToken !== 'string' || !appToken.trim()) {
        throw new Error('A Microsoft Graph application access token is required. Check the app-token error and VITE_APP_SECRET configuration.');
    }
    const defaultHeaders = {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate, br",
    };

    // Add authorization header if token provided
    if (appToken) {
        defaultHeaders.Authorization = `Bearer ${appToken}`;
    }

    const requestOptions = {
        method: 'GET',
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    const response = await fetch(withDcParameter(`https://${msGraphDomain}${endpoint}`, routingQueryParameters.dc), requestOptions);

    if (!response.ok) {
        await parseGraphApiError(response);
    }

    return response;
}

/**
 * Make a GET request to Microsoft Graph API
 * @param {string} endpoint - API endpoint path
 * @param {string} appToken - Bearer token for authentication
 * @param {Object} headers - Additional headers
 * @returns {Promise<Response>} - Fetch response object
 */
export async function graphGet(endpoint, appToken, headers = {}) {
    return makeGraphRequest(endpoint, { method: 'GET', headers }, appToken);
}

/**
 * Make a POST request to Microsoft Graph API
 * @param {string} endpoint - API endpoint path
 * @param {Object} body - Request body object
 * @param {string} appToken - Bearer token for authentication
 * @param {Object} headers - Additional headers
 * @returns {Promise<Response>} - Fetch response object
 */
export async function graphPost(endpoint, body, appToken, headers = {}) {
    return makeGraphRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        headers
    }, appToken);
}

/**
 * Make a DELETE request to Microsoft Graph API
 * @param {string} endpoint - API endpoint path
 * @param {string} appToken - Bearer token for authentication
 * @param {Object} headers - Additional headers
 * @returns {Promise<Response>} - Fetch response object
 */
export async function graphDelete(endpoint, appToken, headers = {}) {
    return makeGraphRequest(endpoint, { method: 'DELETE', headers }, appToken);
}
