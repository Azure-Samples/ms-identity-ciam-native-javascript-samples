/**
 * HTTP client for the Microsoft Entra "My Account" passkey API
 * (https://login.microsoftonline.com/{tenantId}/api/v1.0).
 *
 * This is the migration target that is replacing the Microsoft Graph
 * fido2Methods endpoints. Endpoints are migrated here one at a time.
 * Currently wired up: GET /me/methods (list), POST /me/methods/fido (start
 * enrollment), POST .../activate (complete enrollment) and DELETE
 * /me/methods/fido/{id} (remove a passkey).
 */

import { appConfig } from '../authConfig';
import { parseGraphApiError } from './GraphApiClient.js';

/**
 * Hardcoded query parameters required to exercise the test environment.
 * - dc pins the datacenter/forest ring used for testing.
 * - myaccessgrpccanary routes the request through the canary code path.
 */
const TEST_QUERY_STRING = 'dc=ESTS-PUB-SCUS-FD000-TEST1-100&myaccessgrpccanary=true';

/**
 * Build a full My Account API URL for the given path, appending the required
 * hardcoded test query parameters. The tenant comes from appConfig.tenantId.
 *
 * Accepts either a path relative to the `/api/v1.0` base (e.g. `/me/methods`)
 * or a full HAL href that already includes the base (e.g.
 * `/api/v1.0/me/methods/fido/{id}/activate`).
 * @param {string} path - API path or HAL href
 * @returns {string} Fully-qualified request URL
 */
function buildUrl(path) {
    const apiBase = '/api/v1.0';
    const relativePath = path.startsWith(apiBase) ? path.slice(apiBase.length) : path;
    return `https://login.microsoftonline.com/${appConfig.tenantId}${apiBase}${relativePath}?${TEST_QUERY_STRING}`;
}

/**
 * Build the common request headers, attaching the Bearer token when provided.
 * @param {string} method - HTTP verb advertised via the Allow header
 * @param {string} token - Bearer token for authentication
 * @param {Object} extra - Additional headers to merge in
 * @returns {Object} Request headers
 */
function buildHeaders(method, token, extra = {}) {
    const requestHeaders = {
        'Content-Type': 'application/hal+json',
        'Allow': method,
        ...extra,
    };

    if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    return requestHeaders;
}

/**
 * Make a GET request to the My Account passkey API.
 * @param {string} path - API path beginning with '/' (e.g. '/me/methods')
 * @param {string} token - Bearer token for authentication (provided at runtime)
 * @param {Object} headers - Additional headers to merge in
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} Formatted error if the request fails
 */
export async function myAccountGet(path, token, headers = {}) {
    const response = await fetch(buildUrl(path), {
        method: 'GET',
        headers: buildHeaders('GET', token, headers),
    });

    if (!response.ok) {
        await parseGraphApiError(response);
    }

    return response;
}

/**
 * Make a POST request to the My Account passkey API.
 * @param {string} path - API path or HAL href (e.g. '/me/methods/fido')
 * @param {Object} [body] - Request body object; omitted when undefined
 * @param {string} token - Bearer token for authentication (provided at runtime)
 * @param {Object} headers - Additional headers to merge in
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} Formatted error if the request fails
 */
export async function myAccountPost(path, body, token, headers = {}) {
    const response = await fetch(buildUrl(path), {
        method: 'POST',
        headers: buildHeaders('POST', token, headers),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        await parseGraphApiError(response);
    }

    return response;
}

/**
 * Make a DELETE request to the My Account passkey API.
 * @param {string} path - API path or HAL href (e.g. '/me/methods/fido/{id}')
 * @param {string} token - Bearer token for authentication (provided at runtime)
 * @param {Object} headers - Additional headers to merge in
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} Formatted error if the request fails
 */
export async function myAccountDelete(path, token, headers = {}) {
    const response = await fetch(buildUrl(path), {
        method: 'DELETE',
        headers: buildHeaders('DELETE', token, headers),
    });

    if (!response.ok) {
        await parseGraphApiError(response);
    }

    return response;
}
