/**
 * Utility functions for Microsoft Graph API services
 * Contains encoding, formatting, and data transformation utilities
 */

/**
 * Convert base64url string to ArrayBuffer for WebAuthn operations
 * @param {string} base64url - Base64url encoded string
 * @returns {ArrayBuffer} - Decoded array buffer
 */
export function base64urlToBuffer(base64url) {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

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
 * Format date string as relative time (e.g., "Today", "2 days ago")
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted relative time string
 */
export function formatLastUsed(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
        return "Today";
    } else if (diffInDays === 1) {
        return "1 day ago";
    } else if (diffInDays < 7) {
        return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
        const weeks = Math.floor(diffInDays / 7);
        return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
    } else {
        const months = Math.floor(diffInDays / 30);
        return months === 1 ? "1 month ago" : `${months} months ago`;
    }
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
 * @param {string} passkeyType - Raw passkey type from Graph API
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

/**
 * Transform Microsoft Graph FIDO2 methods response to UI-friendly format
 * @param {Object} graphResponse - Raw response from Graph API
 * @returns {Array<Object>} - Array of transformed passkey objects
 */
export function transformFido2Methods(graphResponse) {
    if (!graphResponse || !graphResponse.value) {
        return [];
    }
    return graphResponse.value.map((method) => ({
        id: method.id,
        name: method.displayName || "Unnamed Passkey",
        lastUsed: method.lastUsedDateTime
            ? formatLastUsed(method.lastUsedDateTime)
            : "Never",
        created: method.createdDateTime
            ? formatDetailedDate(method.createdDateTime)
            : "Unknown",
        model: method.model || "Unknown Model",
        attestationLevel: method.attestationLevel || "Unknown",
        aaGuid: method.aaGuid,
        passkeyType: formatPasskeyType(method.passkeyType),
        _graphData: method,
    }));
}

export function decodeGraphCredentialId(id) {
    // Match base and suffix number
    const match = id.match(/^(.*?)(\d)$/);
    if (!match) throw new Error("Invalid Microsoft Graph credential ID format");

    let [, base, padCountStr] = match;
    const padCount = parseInt(padCountStr, 10);

    // Add '=' padding
    base += "=".repeat(padCount);

    // Convert Base64URL → Base64
    base = base.replace(/-/g, "+").replace(/_/g, "/");

    // Decode to bytes
    const binary = atob(base);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i) {
        buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
}
