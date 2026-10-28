/**
 * Utility functions and constants for passkey operations
 */

/**
 * Constants for passkey operations and retry logic
 * @type {Object}
 * @property {number} MAX_PASSKEYS - Maximum number of passkeys allowed per user
 * @property {number} MAX_RETRIES - Maximum number of retry attempts for operations
 * @property {number} RETRY_DELAY_BASE - Base delay in milliseconds for retry operations
 * @property {number} FETCH_DELAY_BASE - Base delay in milliseconds for fetch operations
 */
export const PASSKEY_CONSTANTS = {
    MAX_PASSKEYS: 10,
    MAX_RETRIES: 5,
    RETRY_DELAY_BASE: 500,
    FETCH_DELAY_BASE: 300
};

/**
 * Create a delay for retry operations with exponential backoff
 * @param {number} attempt - Current attempt number (1-based)
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves after the delay
 */
export const createRetryDelay = (attempt, baseDelay = PASSKEY_CONSTANTS.RETRY_DELAY_BASE) => 
    new Promise(resolve => setTimeout(resolve, baseDelay * attempt));

/**
 * Create a delay for fetch operations with exponential backoff
 * @param {number} attempt - Current attempt number (1-based)
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves after the delay
 */
export const createFetchDelay = (attempt, baseDelay = PASSKEY_CONSTANTS.FETCH_DELAY_BASE) => 
    new Promise(resolve => setTimeout(resolve, baseDelay * attempt));

/**
 * Validate if the expected change occurred in the passkey list
 * @param {Array} passkeys - Current list of passkeys
 * @param {Object} expectedChange - Expected change object
 * @param {string} expectedChange.type - Type of change ('add' or 'delete')
 * @param {string} expectedChange.passkeyId - ID of passkey for delete operations
 * @param {number} expectedChange.expectedCount - Expected count for add operations
 * @returns {boolean} - True if the expected change is satisfied
 */
export const validateExpectedChange = (passkeys, expectedChange) => {
    if (!expectedChange) return true;
    
    const { type, passkeyId, expectedCount } = expectedChange;
    
    if (type === 'add' && expectedCount) {
        return passkeys.length >= expectedCount;
    }
    
    if (type === 'delete' && passkeyId) {
        return !passkeys.some(p => p.id === passkeyId);
    }
    
    return true;
};

/**
 * Check if NGCMFA token has expired
 * @param {number} ngcmfaExpiry - NGCMFA expiration timestamp in seconds
 * @returns {boolean} - True if expired, false if still valid
 */
export const checkNgcmfaExpiration = (ngcmfaExpiry) => {
    if (!ngcmfaExpiry) {
        console.log('NGCMFA check: No expiry time available - considering expired');
        return true; // Consider expired if no expiry time available
    }
    
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const isExpired = currentTimeInSeconds > ngcmfaExpiry;
    const timeUntilExpiry = ngcmfaExpiry - currentTimeInSeconds;
    
    console.log('NGCMFA expiration check:', {
        currentTime: currentTimeInSeconds,
        expiryTime: ngcmfaExpiry,
        timeUntilExpiry: timeUntilExpiry,
        isExpired: isExpired
    });
    
    return isExpired;
};

/**
 * Factory object for creating standardized toast notification messages
 * @type {Object}
 * @property {Function} passkeyAdded - Creates success message for passkey addition
 * @property {Function} passkeyDeleted - Creates success message for passkey deletion
 * @property {Function} passkeysRefreshed - Creates success message for passkey list refresh
 * @property {Function} errorLoading - Creates error message for loading failures
 * @property {Function} errorAdding - Creates error message for addition failures
 * @property {Function} errorDeleting - Creates error message for deletion failures
 * @property {Function} sessionExpired - Creates warning message for session expiration
 * @property {Function} sessionExpiredWithAction - Creates interactive message for session expiration
 * @property {Function} authError - Creates error message for authentication failures
 */
export const createToastMessages = {
    passkeyAdded: () => ({
        title: 'Passkey added',
        message: 'Successfully added passkey.',
        variant: 'success'
    }),
    
    passkeyDeleted: (passkeyName = 'Unknown') => ({
        title: 'Passkey deleted',
        message: `Passkey ${passkeyName} has been deleted.`,
        variant: 'success'
    }),
    
    passkeysRefreshed: (count) => ({
        title: 'Passkeys refreshed',
        message: `Found ${count} passkey(s).`,
        variant: 'success'
    }),
    
    errorLoading: () => ({
        title: 'Error loading passkeys',
        message: 'Failed to load your passkeys. Please try again.',
        variant: 'danger'
    }),
    
    errorAdding: (errorMessage) => ({
        title: 'Error adding passkey',
        message: `Failed to add your passkey. Please try again: ${errorMessage}`,
        variant: 'danger'
    }),

    passkeyAddCancelled: (errorMessage) => ({
        title: 'Error adding passkey',
        message: `Failed to add your passkey. The operation either timed out or was not allowed or passkey already registered on this device. Please try again.`,
        variant: 'danger'
    }),
    
    errorDeleting: (errorMessage) => ({
        title: 'Error deleting passkey',
        message: `Failed to delete your passkey. Please try again: ${errorMessage}`,
        variant: 'danger'
    }),
    
    sessionExpired: () => ({
        title: 'Session expired',
        message: 'Your session has expired. Redirecting to sign in...',
        variant: 'warning'
    }),
    
    sessionExpiredWithAction: (onSignIn) => ({
        title: `Let's keep your account secure`,
        message: 'You will need to complete multi-factor authentication to perform this action. You will be redirected to verify your identity securely.',
        variant: 'warning',
        autoHide: false,  // Keep visible until user acts
        type: 'sessionExpiredWithAction', // Unique identifier for center positioning
        action: {
            label: 'Next',
            variant: 'primary',
            onClick: onSignIn
        }
    }),
    
    authError: () => ({
        title: 'Authentication error',
        message: 'Failed to re-authenticate. Please try again.',
        variant: 'danger'
    }),

    duplicateRegistrationWarning: (count) => ({
        title: 'Duplicate registration warning',
        message: `To avoid registration failure, please use a different security key or phone than previously used.`,
        variant: 'warning'
    })
};
