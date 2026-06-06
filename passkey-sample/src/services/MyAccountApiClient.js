/**
 * HTTP client for the Microsoft Entra "My Account" passkey API
 * (https://login.microsoftonline.com/{tenantId}/api/v1.0).
 *
 * This is the migration target that is replacing the Microsoft Graph
 * fido2Methods endpoints. Endpoints are migrated here one at a time.
 * Currently wired up: GET /me/methods (list authentication methods).
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
 * @param {string} path - API path beginning with '/' (e.g. '/me/methods')
 * @returns {string} Fully-qualified request URL
 */
function buildUrl(path) {
    return `https://login.microsoftonline.com/${appConfig.tenantId}/api/v1.0${path}?${TEST_QUERY_STRING}`;
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
    const requestHeaders = {
        'Content-Type': 'application/hal+json',
        'Allow': 'GET',
        ...headers,
    };

    if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(buildUrl(path), {
        method: 'GET',
        headers: requestHeaders,
    });

    if (!response.ok) {
        await parseGraphApiError(response);
    }

    return response;
}
