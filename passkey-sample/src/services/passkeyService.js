import { getSelfServiceAccessToken } from '../utils/selfServiceToken';
import { base64urlToBuffer, bufferToBase64url, formatDetailedDate, formatPasskeyType, generateUniquePasskeyName } from '../utils/graphServiceUtils';
import { METHODS_PATH, fetchSelfServiceMethods, requestMethod } from './selfServiceApiClient';

function normalizeCredentialId(id) {
    const match = id.match(/^(.*)(\d)$/);
    if (!match) {
        return id;
    }
    const [, base, padCountStr] = match;
    const padCount = Number(padCountStr);
    return padCount === (4 - (base.length % 4)) % 4 ? base : id;
}

export function adaptSelfServicePasskeys(methods) {
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
            deleteHref: method._links?.delete?.href,
        };
    });
}

/** Delete a FIDO method using the action returned by the Self Service API. */
export async function deleteSelfServicePasskey(instance, account, deleteHref) {
    if (typeof deleteHref !== 'string' || !deleteHref) {
        throw new Error('This passkey cannot be deleted with the Self Service API');
    }

    const token = await getSelfServiceAccessToken(instance, account);
    await requestMethod(deleteHref, 'DELETE', token);
}

/** List the signed-in user's FIDO methods in the existing passkey UI format. */
export async function fetchSelfServicePasskeys(instance, account) {
    return adaptSelfServicePasskeys(await fetchSelfServiceMethods(instance, account));
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
export async function registerSelfServicePasskey(instance, account, displayName = '') {
    if (typeof displayName !== 'string') {
        throw new Error('Passkey name must be a string');
    }
    const passkeyName = displayName.trim() || generateUniquePasskeyName();
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
        authenticatorSelection: { ...options.authenticatorSelection },
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
    // Offer local and external authenticators without changing other requirements.
    delete publicKey.authenticatorSelection.authenticatorAttachment;
    if (publicKey.extensions?.enforceCredentialProtectionPolicy) {
        publicKey.extensions = { ...publicKey.extensions, enforceCredentialProtectionPolicy: false };
    }

    const credential = await navigator.credentials.create({ publicKey });
    if (!credential?.id || !credential.response?.attestationObject || !credential.response?.clientDataJSON) {
        throw new Error('Passkey creation returned no credential or attestation');
    }

    const method = await activatePasskeyEnrollment(start._links.activate.href, {
        continuationToken: start.continuationToken,
        displayName: passkeyName,
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
