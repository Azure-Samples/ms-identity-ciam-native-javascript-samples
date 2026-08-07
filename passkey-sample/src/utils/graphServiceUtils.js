/**
 * Utility functions used by the credential-management SDK client
 * Contains encoding, formatting, and data transformation utilities
 */

/**
 * Convert ArrayBuffer to base64url string for WebAuthn operations
 * @param {ArrayBuffer} buffer - Array buffer to encode
 * @returns {string} - Base64url encoded string
 */
export function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Format date string as detailed localized date and time
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted detailed date string
 */
export function formatDetailedDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return dateString;
    }
}

/**
 * Format passkey type for display with proper capitalization
 * @param {string} passkeyType - Raw passkey type value
 * @returns {string} - Formatted passkey type for display
 */
export function formatPasskeyType(passkeyType) {
    if (!passkeyType) return "Unknown Passkey Type";
    
    switch (passkeyType.toLowerCase()) {
        case 'synced':
            return 'Synced';
        case 'devicebound':
            return 'Device Bound';
        default:
            return passkeyType; // Return original if unknown type
    }
}

/**
 * Generate a unique passkey name with timestamp and random suffix
 * @returns {string} - Unique passkey name
 */
export function generateUniquePasskeyName() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `passkey_${timestamp}_${randomSuffix}`;
}
