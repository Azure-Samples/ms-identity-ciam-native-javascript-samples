import { selfServiceApiConfig } from '../authConfig';
import { getSelfServiceAccessToken } from '../utils/selfServiceToken';

export const METHODS_PATH = '/api/v1.0/me/methods';

export function buildMethodUrl(path) {
    const link = new URL(path, 'https://login.microsoftonline.com');
    const pathname = link.pathname;
    const methodsIndex = pathname.indexOf(METHODS_PATH);
    if (methodsIndex < 0) {
        throw new Error('Expected a Self Service API methods link');
    }

    const methodPath = pathname.slice(methodsIndex);
    if (methodPath !== METHODS_PATH && !methodPath.startsWith(`${METHODS_PATH}/`)) {
        throw new Error('Invalid Self Service API methods link');
    }

    const base = selfServiceApiConfig.authority;
    const url = new URL(`${base.replace(/\/$/, '')}${methodPath}`);
    link.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    Object.entries(selfServiceApiConfig.apiQueryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    return url;
}

export async function requestMethod(path, method, token, body, options = {}) {
    if (!token) {
        throw new Error('A user access token is required for the Self Service API');
    }

    const response = await fetch(buildMethodUrl(path), {
        ...options,
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/hal+json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
        let message = `Self Service API returned HTTP ${response.status}`;
        const errorText = await response.text();
        if (errorText) {
            try {
                const error = JSON.parse(errorText);
                message = error.error?.message || error.message || message;
            } catch {
                // Keep the HTTP status if the response is not a JSON API error.
            }
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return response;
}

export async function fetchSelfServiceMethods(instance, account, options) {
    const token = await getSelfServiceAccessToken(instance, account);
    const response = await requestMethod(METHODS_PATH, 'GET', token, undefined, options);
    const collection = await response.json();
    const methods = collection?._embedded?.methods;
    if (!Array.isArray(methods)) {
        throw new Error('Unexpected Self Service API methods response: _embedded.methods is missing');
    }

    return methods;
}
