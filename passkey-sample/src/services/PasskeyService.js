/**
 * Service for passkey (FIDO2) operations.
 * List and registration (start enrollment + activate) use the My Account API;
 * deletion still uses Microsoft Graph (pending migration).
 */

import { 
    base64urlToBuffer, 
    bufferToBase64url, 
    transformFido2Methods,
    generateUniquePasskeyName
} from '../utils/graphServiceUtils.js';
import { myAccountGet, myAccountPost, myAccountDelete } from './MyAccountApiClient.js';
import { appConfig } from '../authConfig';

/**
 * Create a WebAuthn credential using the browser's Credential Management API.
 * @param {Object} creationOptions - WebAuthn public key creation options
 *                 (base64url-encoded challenge, user.id and excludeCredentials ids)
 * @returns {Promise<PublicKeyCredential>} - Created credential
 */
async function createCredential(creationOptions) {
    const excludeCredentials = (creationOptions.excludeCredentials || []).map((c) => ({
        ...c,
        id: base64urlToBuffer(c.id),
    }));

    const publicKey = {
        ...creationOptions,
        challenge: base64urlToBuffer(creationOptions.challenge),
        user: {
            ...creationOptions.user,
            id: base64urlToBuffer(creationOptions.user.id),
        },
        excludeCredentials,
    };

    // For local development the rp.id must match the host serving the app;
    // allow overriding it with a configured custom domain.
    if (appConfig.customDomain) {
        publicKey.rp = { ...creationOptions.rp, id: appConfig.customDomain };
    }

    // Local-testing workaround: the test environment returns a credProtect
    // policy ("userVerificationOptional") that is inconsistent with
    // requireResidentKey + userVerification:"required" and can cause the browser
    // ("protection policy is inconsistent...") or the authenticator
    // (NotAllowedError) to reject the request. Strip the credProtect policy for
    // local testing (keep other extensions such as hmac-secret).
    if (publicKey.extensions) {
        const { credentialProtectionPolicy, enforceCredentialProtectionPolicy, ...restExtensions } = publicKey.extensions;
        if (credentialProtectionPolicy || enforceCredentialProtectionPolicy) {
            publicKey.extensions = restExtensions;
            console.warn('Stripped credProtect extension for local testing');
        }
    }

    // The test environment can return timeout:0, which some browsers treat as an
    // immediate expiry. Use a sane default so the user has time to complete UV.
    if (!publicKey.timeout) {
        publicKey.timeout = 120000;
    }

    console.log(
        `Passkey creation options configured. Server rp.id="${creationOptions.rp?.id}", ` +
        `using rp.id="${publicKey.rp?.id}" against origin "${window.location.origin}"`
    );
    try {
        const credential = await navigator.credentials.create({ publicKey });
        console.log("Passkey credential created successfully");
        return credential;
    } catch (error) {
        console.error(
            `navigator.credentials.create failed: ${error.name}: ${error.message}`,
            error
        );
        throw error;
    }
}

/**
 * Resolve the activation URL for an enrollment. Prefers the HAL `activate`
 * link, falling back to the documented URL template
 * `/me/methods/{type}/{id}/activate`.
 * @param {Object} enrollment - Start-enrollment response
 * @returns {string} Activation path or HAL href
 */
function getActivateHref(enrollment) {
    const halHref = enrollment._links?.activate?.href;
    if (halHref) {
        return halHref;
    }
    if (enrollment.id) {
        return `/me/methods/${enrollment.type || 'fido'}/${enrollment.id}/activate`;
    }
    throw new Error("Cannot resolve activation link from enrollment response");
}

/**
 * Complete passkey registration by posting the created credential to the
 * activation endpoint (POST /me/methods/fido/{id}/activate).
 * @param {Object} enrollment - Start-enrollment response (continuationToken, id, _links.activate)
 * @param {PublicKeyCredential} credential - WebAuthn credential from createCredential
 * @param {string} token - Bearer token for authentication
 * @returns {Promise<Object>} - The newly registered method
 */
async function activatePasskey(enrollment, credential, token) {
    const activateHref = getActivateHref(enrollment);

    const publicKeyCredential = {
        id: credential.id,
        attestationObject: bufferToBase64url(credential.response.attestationObject),
        clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
    };

    // clientExtensionResults is OPTIONAL per the design; include when available.
    if (typeof credential.getClientExtensionResults === 'function') {
        publicKeyCredential.clientExtensionResults = credential.getClientExtensionResults();
    }

    const body = {
        continuationToken: enrollment.continuationToken,
        displayName: generateUniquePasskeyName(),
        publicKeyCredential,
    };

    console.log("Activating passkey registration");
    const response = await myAccountPost(activateHref, body, token);
    return response.json();
}

/**
 * Get user's passkeys from the My Account API (GET /me/methods).
 * The user is resolved from the bearer token, so no user ID is required.
 * @param {string} token - Bearer token for authentication
 * @returns {Promise<Object>} - Raw API response
 */
async function getUserPasskeys(token) {
    const response = await myAccountGet('/me/methods', token);

    const passkeys = await response.json();
    console.log(`Retrieved ${passkeys?._embedded?.methods?.length || 0} authentication methods`);
    return passkeys;
}

/**
 * Start enrollment of a new passkey (POST /me/methods/fido).
 * Returns the provisioning session containing the WebAuthn creation options
 * (`publicKey`), the `continuationToken`, and the `_links.activate` link used
 * to complete registration.
 * @param {string} token - Bearer token for authentication
 * @returns {Promise<Object>} - Start-enrollment response
 */
export async function startPasskeyEnrollment(token) {
    const response = await myAccountPost('/me/methods/fido', undefined, token);
    return response.json();
}

/**
 * Register a new passkey: run the WebAuthn ceremony using the enrollment's
 * creation options, then activate the credential.
 * @param {Object} enrollment - Start-enrollment response from startPasskeyEnrollment
 * @param {string} token - Bearer token for authentication
 * @returns {Promise<void>} Resolves when passkey registration is complete
 * @throws {Error} Throws if passkey registration fails
 */
export async function registerUserPasskey(enrollment, token) {
    const creationOptions = typeof enrollment.publicKey === 'string'
        ? JSON.parse(enrollment.publicKey)
        : enrollment.publicKey;

    console.log('Raw WebAuthn creation options from server:', JSON.stringify(creationOptions, null, 2));

    const credential = await createCredential(creationOptions);
    await activatePasskey(enrollment, credential, token);
}

/**
 * Fetch and transform user passkeys from the My Account API
 * @param {string} appToken - Bearer token for authentication
 * @param {string} userId - Retained for signature compatibility; the My Account
 *                          API resolves the user from the token (/me), so it is unused here
 * @returns {Promise<Array<Object>>} Promise that resolves to array of transformed passkey objects
 * @throws {Error} Throws error if fetching passkeys fails
 */
export async function fetchUserPasskey(appToken, userId) {
    const passkeys = await getUserPasskeys(appToken);
    return transformFido2Methods(passkeys);
}

/**
 * Delete a registered passkey (DELETE /me/methods/fido/{id}).
 * @param {string} token - Bearer token for authentication
 * @param {string} passkeyId - The ID of the passkey to delete
 * @param {string} [deleteHref] - Optional HAL delete link; preferred when present,
 *                                otherwise the path is built from the id
 * @returns {Promise<void>} Resolves when passkey deletion is complete
 * @throws {Error} Throws if passkey deletion fails
 */
export async function deleteUserPasskey(token, passkeyId, deleteHref) {
    const path = deleteHref || `/me/methods/fido/${passkeyId}`;
    await myAccountDelete(path, token);

    console.log(`Passkey deleted successfully!`);
}
