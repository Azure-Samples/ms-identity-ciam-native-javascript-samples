/**
 * Parse device model string to extract authenticator device and method
 * @param {string} modelString - The model string from passkey data
 * @returns {Object} Object containing authenticatorDevice and method
 */
export const parseDeviceModel = (modelString) => {
    if (!modelString) {
        return { authenticatorDevice: 'Unknown Device', method: 'Unknown Method' };
    }
    
    const withIndex = modelString.toLowerCase().indexOf(' with ');
    
    if (withIndex === -1) {
        // No "with" found, return full string as device
        return { authenticatorDevice: modelString.trim(), method: 'Standard' };
    }
    
    const authenticatorDevice = modelString.substring(0, withIndex).trim();
    const method = modelString.substring(withIndex + 6).trim(); // +6 for " with "
    
    return { 
        authenticatorDevice: authenticatorDevice || 'Unknown Device', 
        method: method || 'Unknown Method' 
    };
};
