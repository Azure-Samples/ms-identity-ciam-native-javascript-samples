import { useState, useCallback } from 'react';
import { fetchUserPasskey } from '../../services/PasskeyService';
import { PASSKEY_CONSTANTS, createRetryDelay, createFetchDelay, createToastMessages } from '../../utils/passkeyUtils';

/**
 * Hook for managing passkey data fetching with retry logic
 * @param {Object} params - Hook parameters
 * @param {string} params.appToken - Authentication token
 * @param {string} params.userId - User ID
 * @param {Function} params.onShowToast - Toast notification function
 * @returns {Object} Passkey data and fetching utilities
 */
export const usePasskeyFetcher = ({ appToken, userId, onShowToast }) => {
    const [passkeys, setPasskeys] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPasskeys = useCallback(async (expectedChange = null, options = {}) => {
        const { 
            maxRetries = expectedChange ? PASSKEY_CONSTANTS.MAX_RETRIES : 1,
            showToast = false,
            setLoadingState = true,
        } = options;

        if (!appToken || !userId) {
            setError('Access token or user ID not available');
            if (setLoadingState) setIsLoading(false);
            return;
        }

        let lastError;
        
        if (setLoadingState) {
            setIsLoading(true);
            setError(null);
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (maxRetries > 1) {
                    console.log(`Fetch attempt ${attempt}/${maxRetries}...`);
                }
                
                const transformedPasskeys = await fetchUserPasskey(appToken, userId);
                console.log(`Found ${transformedPasskeys.length} passkeys${maxRetries > 1 ? ` on attempt ${attempt}` : ''}`);
                
                if (expectedChange) {
                    const { type, passkeyId, expectedCount } = expectedChange;
                    
                    if (type === 'add' && expectedCount && transformedPasskeys.length < expectedCount) {
                        console.log(`Expected ${expectedCount} passkeys after add, but got ${transformedPasskeys.length}. Retrying...`);
                        if (attempt < maxRetries) {
                            await createRetryDelay(attempt);
                            continue;
                        }
                    }
                    
                    if (type === 'delete' && passkeyId && transformedPasskeys.some(p => p.id === passkeyId)) {
                        console.log(`Passkey ${passkeyId} still exists after delete. Retrying...`);
                        if (attempt < maxRetries) {
                            await createRetryDelay(attempt);
                            continue;
                        }
                    }
                }
                
                setPasskeys(transformedPasskeys);
                console.log(`Successfully updated passkey list with ${transformedPasskeys.length} items`);
                
                if (setLoadingState) {
                    setIsLoading(false);
                }
                
                if (showToast && transformedPasskeys.length > 0 && onShowToast) {
                    onShowToast(createToastMessages.passkeysRefreshed(transformedPasskeys.length));
                }
                
                return transformedPasskeys;
                
            } catch (error) {
                lastError = error;
                if (maxRetries > 1) {
                    console.warn(`Fetch attempt ${attempt} failed:`, error);
                } else {
                    console.error('Error fetching passkeys:', error);
                }
                
                if (attempt < maxRetries) {
                    await createFetchDelay(attempt);
                }
            }
        }
        
        const errorMsg = `Failed to load passkeys: ${lastError?.message || 'Unknown error'}`;
        setError(errorMsg);
        
        if (onShowToast) {
            onShowToast(createToastMessages.errorLoading());
        }
        
        if (setLoadingState) {
            setIsLoading(false);
        }
        
        if (expectedChange) {
            throw lastError || new Error('Max retries exceeded');
        }
        
        return null;
    }, [appToken, userId, onShowToast]);

    const refetch = useCallback(() => {
        return fetchPasskeys();
    }, [fetchPasskeys]);

    return {
        passkeys,
        isLoading,
        error,
        fetchPasskeys,
        refetch
    };
};
