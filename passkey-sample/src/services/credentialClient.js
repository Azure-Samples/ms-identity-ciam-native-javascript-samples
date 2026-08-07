/**
 * Thin wrapper around the @azure/msal-credential-management-browser SDK.
 *
 * Builds the credential-methods client once (the SDK's `tokenProvider` mints an
 * access token for the My Account API via the refresh-token exchange) and
 * adapts the SDK's typed result into the UI-friendly passkey shape the existing
 * components consume.
 */

import { createCredentialMethodsClient, RegistrationStates, CredentialMethodTypes } from '@azure/msal-credential-management-browser';
import { credentialApiConfig } from '../authConfig';
import { getMyAccountApiToken } from '../utils/myAccountToken';
import { bufferToBase64url, generateUniquePasskeyName, formatDetailedDate, formatPasskeyType } from '../utils/graphServiceUtils';

let client = null;

/**
 * Lazily construct (and memoize) the credential-methods client.
 * @param {Object} instance - MSAL PublicClientApplication instance
 * @returns {import('@azure/msal-credential-management-browser').CredentialMethodsClient}
 */
export function getCredentialClient(instance) {
    if (!client) {
        client = createCredentialMethodsClient({
            authority: credentialApiConfig.authority,
            tokenProvider: () => getMyAccountApiToken(instance),
            apiQueryParams: credentialApiConfig.apiQueryParams,
        });
    }
    return client;
}

/**
 * Map a single SDK CredentialMethod to the UI passkey shape used by the existing
 * components. `lastUsed` stays a placeholder because the My Account API does not
 * report a last-used timestamp for FIDO methods.
 * @param {Object} method - SDK CredentialMethod
 * @returns {Object}
 */
function adaptMethod(method) {
    return {
        id: method.id,
        name: method.displayName || 'Unnamed Passkey',
        lastUsed: 'Never',
        created: method.createdDateTime ? formatDetailedDate(method.createdDateTime) : 'Unknown',
        model: method.model || 'Unknown Model',
        attestationLevel: method.attestationLevel || 'Unknown',
        aaGuid: method.aaGuid,
        passkeyType: formatPasskeyType(method.passkeyType),
        canDelete: method.canDelete,
        _sdkData: method,
    };
}

/**
 * List the signed-in user's registered passkeys via the SDK and adapt them to
 * the UI shape.
 * @param {Object} instance - MSAL PublicClientApplication instance
 * @returns {Promise<Array<Object>>}
 */
export async function listPasskeysViaSdk(instance) {
    const collection = await getCredentialClient(instance).list();
    return collection.registeredMethods
        .filter((method) => method.type === 'fido')
        .map(adaptMethod);
}

/**
 * Delete one of the signed-in user's registered passkeys via the SDK.
 * @param {Object} instance - MSAL PublicClientApplication instance
 * @param {string} id - Server-assigned method id to delete.
 * @returns {Promise<void>}
 */
export async function deletePasskeyViaSdk(instance, id) {
    await getCredentialClient(instance).delete({
        type: CredentialMethodTypes.Fido,
        id,
    });
}

/**
 * Register a new passkey for the signed-in user via the SDK's two-step FIDO
 * ceremony:
 *   1. register.fido() — server returns the WebAuthn creation options.
 *   2. navigator.credentials.create() — the browser drives the platform/roaming
 *      authenticator attestation. Valid for this rp.id now that the app is served
 *      from an origin under the tenant's ciamlogin.com domain.
 *   3. session.activate() — submit the attestation to finalize registration.
 * @param {Object} instance - MSAL PublicClientApplication instance
 * @param {string} [displayName] - Optional label; auto-generated if omitted.
 * @returns {Promise<Object>} The newly registered passkey in the UI shape.
 */
export async function registerPasskeyViaSdk(instance, displayName) {
    const result = await getCredentialClient(instance).register.fido();

    // FIDO is always a two-step flow, but handle the Completed branch defensively.
    if (result.state === RegistrationStates.Completed) {
        return adaptMethod(result.method);
    }

    const { session } = result;
    const publicKey = { ...session.publicKey };
    if (publicKey.extensions?.enforceCredentialProtectionPolicy) {
        publicKey.extensions = {
            ...publicKey.extensions,
            enforceCredentialProtectionPolicy: false,
        };
    }
    // The test env sometimes returns timeout:0; give create() a real budget.
    if (!publicKey.timeout) {
        publicKey.timeout = 120000;
    }

    const credential = await navigator.credentials.create({ publicKey });
    if (!credential) {
        throw new Error('Passkey creation was cancelled or returned no credential.');
    }

    const publicKeyCredential = {
        id: credential.id,
        attestationObjectStr: bufferToBase64url(credential.response.attestationObject),
        clientDataJSONStr: bufferToBase64url(credential.response.clientDataJSON),
    };

    const method = await session.activate({
        displayName: displayName || generateUniquePasskeyName(),
        publicKeyCredential,
    });

    return adaptMethod(method);
}
