import { selfServiceApiConfig } from '../authConfig';
import { getSelfServiceAccessToken } from '../utils/selfServiceToken';
import { base64urlToBuffer, bufferToBase64url, formatDetailedDate, formatPasskeyType, generateUniquePasskeyName } from '../utils/graphServiceUtils';

const METHODS_PATH = '/api/v1.0/me/methods';

function normalizeCredentialId(id) {
    const match = id.match(/^(.*)(\d)$/);
    if (!match) {
        return id;
    }
    const [, base, padCountStr] = match;
    const padCount = Number(padCountStr);
    return padCount === (4 - (base.length % 4)) % 4 ? base : id;
}

function buildMethodUrl(path) {
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

async function requestMethod(path, method, token, body) {
    if (!token) {
        throw new Error('A user access token is required for the Self Service API');
    }

    const response = await fetch(buildMethodUrl(path), {
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
        throw new Error(message);
    }
    return response;
}

async function listPasskeyMethods(token) {
    const response = await requestMethod(METHODS_PATH, 'GET', token);
    return response.json();
}

/** List the signed-in user's FIDO methods in the existing passkey UI format. */
export async function fetchSelfServicePasskeys(instance, account) {
    const token = await getSelfServiceAccessToken(instance, account);
    const collection = await listPasskeyMethods(token);
    const methods = collection?._embedded?.methods;
    if (!Array.isArray(methods)) {
        throw new Error('Unexpected Self Service API methods response: _embedded.methods is missing');
    }

    return methods.filter(method => method.type === 'fido' || method.type === 'fido2').map(method => {
        if (!method.id) {
            throw new Error('Self Service API returned a FIDO method without an ID');
        }
        return {
            id: method.id,
            name: method.displayName || 'Unnamed Passkey',
            lastUsed: 'Never',
            created: method.createdDateTime ? formatDetailedDate(method.createdDateTime) : 'Unknown',
            model: method.model || 'Unknown Model',
            attestationLevel: method.attestationLevel || 'Unknown',
            aaGuid: method.aaGuid,
            passkeyType: formatPasskeyType(method.passkeyType),
            canDelete: Boolean(method._links?.delete?.href),
        };
    });
}

async function beginPasskeyEnrollment(token) {
    const response = await requestMethod(`${METHODS_PATH}/fido`, 'POST', token);
    return response.json();
}

async function activatePasskeyEnrollment(activateHref, enrollment, token) {
    const response = await requestMethod(activateHref, 'POST', token, enrollment);
    if (response.status === 204) {
        return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

/** Register a FIDO credential using Self Service API start and activation responses. */
export async function registerSelfServicePasskey(instance, account) {
    const token = await getSelfServiceAccessToken(instance, account);
    const start = await beginPasskeyEnrollment(token);
    if (start?.state !== 'interactionRequired' || start.type !== 'fido' ||
        !start.continuationToken || !start._links?.activate?.href ||
        !start.publicKey?.challenge || !start.publicKey?.user?.id || !start.publicKey?.rp?.id) {
        throw new Error('Unexpected Self Service API FIDO enrollment response');
    }

    const options = start.publicKey;
    const publicKey = {
        ...options,
        challenge: base64urlToBuffer(options.challenge),
        user: { ...options.user, id: base64urlToBuffer(options.user.id) },
        ...(options.excludeCredentials && {
            excludeCredentials: options.excludeCredentials.map(item => ({
                ...item,
                id: base64urlToBuffer(normalizeCredentialId(item.id)),
            })),
        }),
        timeout: options.timeout || 120000,
    };
    if (publicKey.extensions?.enforceCredentialProtectionPolicy) {
        publicKey.extensions = { ...publicKey.extensions, enforceCredentialProtectionPolicy: false };
    }

    const credential = await navigator.credentials.create({ publicKey });
    if (!credential?.id || !credential.response?.attestationObject || !credential.response?.clientDataJSON) {
        throw new Error('Passkey creation returned no credential or attestation');
    }

    const method = await activatePasskeyEnrollment(start._links.activate.href, {
        continuationToken: start.continuationToken,
        displayName: generateUniquePasskeyName(),
        publicKeyCredential: {
            id: credential.id,
            attestationObject: bufferToBase64url(credential.response.attestationObject),
            clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
        },
    }, token);
    if (method?.type !== 'fido' || !method.id) {
        throw new Error('Unexpected Self Service API FIDO activation response');
    }
    return method;
}
