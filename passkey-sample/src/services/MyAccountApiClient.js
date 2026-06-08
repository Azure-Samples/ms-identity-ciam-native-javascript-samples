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
 * Base origin for My Account API requests. In local dev this points at the
 * cors.js proxy (`/myaccount`) to work around browser CORS; when empty the API
 * is called directly.
 */
const API_BASE = appConfig.myAccountProxy || 'https://login.microsoftonline.com';

/**
 * Build a full My Account API URL for the given path, appending the required
 * hardcoded test query parameters. The tenant comes from appConfig.tenantId.
 *
 * Accepts any of:
 *  - a short path relative to the `/api/v1.0` base (e.g. `/me/methods`)
 *  - a full HAL `_links` href returned by the API, which is already a complete
 *    reference (absolute URL or host-absolute path that includes the tenant,
 *    `/api/v1.0` and a `dc` query param), e.g.
 *    `/{tenant}/api/v1.0/me/methods/fido/{id}/activate?dc=...`
 *
 * To handle both consistently, the input is reduced to the method path (the
 * part after `/api/v1.0`) and the URL is rebuilt with exactly one tenant
 * segment and exactly one query string. This avoids the duplicated path /
 * duplicated `dc` param that results from naively concatenating a full HAL href.
 *
 * Note: any query string carried on a HAL href is intentionally discarded in
 * favour of TEST_QUERY_STRING, which pins the same test datacenter (`dc`) and
 * adds the required `myaccessgrpccanary` flag.
 * @param {string} path - API path or HAL href
 * @returns {string} Fully-qualified request URL
 */
function buildUrl(path) {
    const apiBase = '/api/v1.0';

    // Reduce the input to a pathname, dropping any origin and query string.
    let pathname = path;
    if (/^https?:\/\//i.test(path)) {
        pathname = new URL(path).pathname;
    } else {
        const queryStart = pathname.indexOf('?');
        if (queryStart !== -1) {
            pathname = pathname.slice(0, queryStart);
        }
    }

    // Strip everything up to and including the /api/v1.0 segment, leaving the
    // method path (e.g. "/me/methods/fido/{id}/activate").
    const apiIndex = pathname.indexOf(apiBase);
    const methodPath = apiIndex !== -1 ? pathname.slice(apiIndex + apiBase.length) : pathname;

    return `${API_BASE}/${appConfig.tenantId}${apiBase}${methodPath}?${TEST_QUERY_STRING}`;
}

/**
 * Log full diagnostic information for a failed My Account API response: the
 * status line, every readable response header, and the complete raw response
 * body. The response is cloned so the original body remains available for the
 * subsequent error parsing.
 *
 * Note: under CORS, JavaScript can only read "simple" response headers plus any
 * listed in the proxy's Access-Control-Expose-Headers; other custom headers are
 * hidden from the browser regardless of this logging.
 * @param {Response} response - Fetch response object
 * @param {string} method - HTTP verb
 * @param {string} url - Request URL
 */
async function logErrorDiagnostics(response, method, url) {
    const headers = {};
    response.headers.forEach((value, name) => {
        headers[name] = value;
    });

    let body = '';
    try {
        body = await response.clone().text();
    } catch (err) {
        body = `<unable to read response body: ${err.message}>`;
    }

    console.error(
        `My Account API ${method} ${url} failed: HTTP ${response.status} ${response.statusText}\n` +
        `Response headers:\n${JSON.stringify(headers, null, 2)}\n` +
        `Response body:\n${body}`
    );
}

/**
 * Build the common request headers, attaching the Bearer token when provided.
 * @param {string} method - HTTP verb advertised via the Allow header
 * @param {string} token - Bearer token for authentication
 * @param {Object} extra - Additional headers to merge in (override the defaults)
 * @param {string} [contentType] - Content-Type for the request. Defaults to
 *        'application/hal+json' (HAL reads); a POST body is sent as
 *        'application/x-www-form-urlencoded'.
 * @returns {Object} Request headers
 */
function buildHeaders(method, token, extra = {}, contentType = 'application/hal+json') {
    const requestHeaders = {
        'Content-Type': contentType,
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
    const url = buildUrl(path);
    const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders('GET', token, headers),
    });

    if (!response.ok) {
        await logErrorDiagnostics(response, 'GET', url);
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
    const url = buildUrl(path);
    // The activate endpoint expects the body declared as
    // application/x-www-form-urlencoded; the JSON payload itself is sent
    // unchanged. Requests without a body keep the default hal+json. Callers can
    // still override the Content-Type via the headers argument.
    const contentType = body !== undefined ? 'application/x-www-form-urlencoded' : undefined;
    const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders('POST', token, headers, contentType),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        await logErrorDiagnostics(response, 'POST', url);
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
    const url = buildUrl(path);
    const response = await fetch(url, {
        method: 'DELETE',
        headers: buildHeaders('DELETE', token, headers),
    });

    if (!response.ok) {
        await logErrorDiagnostics(response, 'DELETE', url);
        await parseGraphApiError(response);
    }

    return response;
}
