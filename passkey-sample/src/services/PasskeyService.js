/**
 * Microsoft Graph API service for passkey (FIDO2) operations
 * Handles passkey registration, retrieval, and deletion
 */

import { 
    base64urlToBuffer, 
    bufferToBase64url, 
    transformFido2Methods,
    generateUniquePasskeyName,
    decodeGraphCredentialId
} from '../utils/graphServiceUtils.js';
import { graphGet, graphPost, graphDelete } from './GraphApiClient.js';
import { appConfig } from '../authConfig';

/**
 * Create WebAuthn credential using browser's Credential Management API
 * @param {Object} creationOptions - WebAuthn creation options
 * @returns {Promise<PublicKeyCredential>} - Created credential
 */
async function createCredential(creationOptions) {
    creationOptions.excludeCredentials = creationOptions.excludeCredentials.map(c => ({
        ...c,
        id: decodeGraphCredentialId(c.id)
    }));
    const publicKey = {
        challenge: base64urlToBuffer(creationOptions.challenge),
        rp: {
            id: appConfig.customDomain || creationOptions.rp.id,
            name: creationOptions.rp.name,
        },
        user: {
            id: base64urlToBuffer(creationOptions.user.id),
            name: creationOptions.user.name,
            displayName: creationOptions.user.displayName,
        },
        pubKeyCredParams: creationOptions.pubKeyCredParams,
        excludeCredentials: creationOptions.excludeCredentials,
        timeout: creationOptions.timeout,
        authenticatorSelection: creationOptions.authenticatorSelection,
        attestation: creationOptions.attestation,
    };

    console.log("Passkey creation options configured");
    try {
        const credential = await navigator.credentials.create({ publicKey });
        console.log("Passkey credential created successfully");
        return credential;

    } catch (error) {
        throw error;
    };
}

/**
 * Register created credential with Microsoft Graph API
 * @param {PublicKeyCredential} creationCredential - WebAuthn credential
 * @param {string} userId - User ID
 * @param {string} appToken - Application access token
 */
async function createPasskey(creationCredential, userId, appToken) {
    const body = {
        publicKeyCredential: {
            id: creationCredential.id,
            response: {
                attestationObject: bufferToBase64url(
                    creationCredential.response.attestationObject
                ),
                clientDataJSON: bufferToBase64url(
                    creationCredential.response.clientDataJSON
                ),
            },
        },
        displayName: generateUniquePasskeyName(),
    };

    console.log("Preparing passkey registration request");

    await graphPost(
        `/users/${userId}/authentication/fido2Methods`,
        body,
        appToken
    );
}

/**
 * Get user's passkeys from Microsoft Graph API
 * @param {string} appToken - Application access token
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Raw Graph API response
 */
async function getUserPasskeys(appToken, userId) {
    const response = await graphGet(
        `/users/${userId}/authentication/fido2Methods`,
        appToken
    );
    
    const passkeys = await response.json();
    console.log(`Retrieved ${passkeys?.value?.length || 0} user passkeys`);
    return passkeys;
}

/**
 * Get passkey creation options from Microsoft Graph API
 * @param {string} appToken - Application access token
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - WebAuthn creation options
 */
export async function getPasskeyCreationOptions(appToken, userId) {
    const response = await graphGet(
        `/users/${userId}/authentication/fido2Methods/creationOptions(challengeTimeoutInMinutes=60)`,
        appToken
    );
    
    const data = await response.json();
    return data.publicKey;
}

/**
 * Register a new passkey for a user using Microsoft Graph API
 * @param {string} appToken - Application access token for Graph API authentication
 * @param {string} userId - The user ID to register the passkey for
 * @returns {Promise<void>} Promise that resolves when passkey registration is complete
 * @throws {Error} Throws error if passkey registration fails
 */
export async function registerUserPasskey(creationOptions, appToken, userId) {
    const credential = await createCredential(creationOptions);
    await createPasskey(credential, userId, appToken);
}

/**
 * Fetch and transform user passkeys from Microsoft Graph API
 * @param {string} appToken - Application access token for Graph API authentication
 * @param {string} userId - The user ID to fetch passkeys for
 * @returns {Promise<Array<Object>>} Promise that resolves to array of transformed passkey objects
 * @throws {Error} Throws error if fetching passkeys fails
 */
export async function fetchUserPasskey(appToken, userId) {
    const passkeys = await getUserPasskeys(appToken, userId);
    return transformFido2Methods(passkeys);
}

/**
 * Delete a specific passkey for a user using Microsoft Graph API
 * @param {string} appToken - Application access token for Graph API authentication
 * @param {string} userId - The user ID that owns the passkey
 * @param {string} passkeyId - The ID of the passkey to delete
 * @returns {Promise<void>} Promise that resolves when passkey deletion is complete
 * @throws {Error} Throws error if passkey deletion fails
 */
export async function deleteUserPasskey(appToken, userId, passkeyId) {
    await graphDelete(
        `/users/${userId}/authentication/fido2Methods/${passkeyId}`,
        appToken
    );
    
    console.log(`Passkey deleted successfully!`);
}
