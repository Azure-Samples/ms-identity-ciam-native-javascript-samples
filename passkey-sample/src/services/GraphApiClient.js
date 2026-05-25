/**
 * Generic HTTP client for Microsoft Graph API
 * Handles authentication, error parsing, and common request patterns
 */

const msGraphDomain = "graph.microsoft.com/beta";

/**
 * Parse Microsoft Graph API error responses with nested JSON structure
 * @param {Response} response - Fetch response object
 * @throws {Error} - Formatted error with detailed message
 */
export async function parseGraphApiError(response) {
    try {
        const errorJson = await response.json();
        
        if (errorJson.error) {
            let errorMessage = errorJson.error.code || 'Unknown error';
            
            if (errorJson.error.message) {
                try {
                    const nestedError = JSON.parse(errorJson.error.message);
                    if (nestedError["odata.error"]?.message?.value) {
                        errorMessage = `${errorMessage}: ${nestedError["odata.error"].message.value}`;
                    }
                } catch (parseError) {
                    errorMessage = `${errorMessage}: ${errorJson.error.message}`;
                }
            }
            
            throw new Error(errorMessage);
        }
        
        throw new Error('Unknown API error');
        
    } catch (error) {
        // If it's already one of our formatted errors, re-throw it
        if (error.message && (error.message.includes('badRequest:') || error.message.includes('unauthorized:') || error.message.includes('forbidden:'))) {
            throw error;
        }
        
        // Fallback for JSON parsing failures
        try {
            const textError = await response.text();
            throw new Error(`HTTP ${response.status}: ${textError}`);
        } catch (textError) {
            throw new Error(`HTTP ${response.status}: Unable to parse error response`);
        }
    }
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

    const response = await fetch(`https://${msGraphDomain}${endpoint}`, requestOptions);

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
