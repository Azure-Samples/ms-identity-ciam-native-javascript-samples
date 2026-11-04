/**
 * Utility functions and constants for passkey operations
 */

/**
 * Constants for passkey operations and retry logic
 * @type {Object}
 * @property {number} MAX_PASSKEYS - Maximum number of passkeys allowed per user
 * @property {number} MAX_RETRIES - Maximum number of retry attempts for operations
 */
export const PASSKEY_CONSTANTS = {
    MAX_PASSKEYS: 10,
    MAX_RETRIES: 5
};

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
 * Factory object for creating standardized toast notification messages
 * @type {Object}
 * @property {Function} passkeyAdded - Creates success message for passkey addition
 * @property {Function} passkeyDeleted - Creates success message for passkey deletion
 * @property {Function} passkeysRefreshed - Creates success message for passkey list refresh
 * @property {Function} errorAdding - Creates error message for addition failures
 * @property {Function} errorDeleting - Creates error message for deletion failures
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
    
    duplicateRegistrationWarning: (count) => ({
        title: 'Duplicate registration warning',
        message: `To avoid registration failure, please use a different security key or phone than previously used.`,
        variant: 'warning'
    })
};
