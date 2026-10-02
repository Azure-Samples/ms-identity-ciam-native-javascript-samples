import { useState, useCallback } from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { fetchMyAccountPasskeys } from '../../services/MyAccountApiClient';
import { redirectForMyAccountAccess } from '../../utils/myAccountToken';
import { PASSKEY_CONSTANTS, createRetryDelay, createFetchDelay, createToastMessages } from '../../utils/passkeyUtils';
import { useAuthentication } from './useAuthentication';

const DOWNSTREAM_TOKEN_ERROR_CODE = 'AADSTS7006105';

const requiresFullReauthentication = (error) => {
    return error?.message?.includes(DOWNSTREAM_TOKEN_ERROR_CODE);
};

/**
 * Hook for managing passkey data fetching with retry logic
 * @param {Object} params - Hook parameters
 * @param {Object} params.instance - MSAL instance
 * @param {Object} params.account - Signed-in account
 * @param {number|null} params.ngcmfaExpiry - Expiration derived from the user token iat
 * @param {Function} params.onShowToast - Toast notification function
 * @returns {Object} Passkey data and fetching utilities
 */
export const usePasskeyFetcher = ({ instance, account, ngcmfaExpiry, onShowToast }) => {
    const [passkeys, setPasskeys] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { isTokenExpired, handleReAuthentication, cacheOperation, getCachedOperation } = useAuthentication({ onShowToast });

    const fetchPasskeys = useCallback(async (expectedChange = null, options = {}) => {
        const { 
            maxRetries = expectedChange ? PASSKEY_CONSTANTS.MAX_RETRIES : 1,
            showToast = false,
            setLoadingState = true,
        } = options;

        const cacheListOperation = () => {
            const pendingOperation = getCachedOperation();
            if (!pendingOperation || pendingOperation.action === 'list') {
                cacheOperation({ action: 'list' });
            }
        };

        if (!account) {
            setError('Sign in to view your passkeys');
            if (setLoadingState) setIsLoading(false);
            return;
        }

        if (isTokenExpired(ngcmfaExpiry)) {
            cacheListOperation();
            const expiryError = new Error('The 15-minute verification has expired. Sign in again to view your passkeys.');
            setError(expiryError.message);
            if (setLoadingState) setIsLoading(false);
            await handleReAuthentication();
            if (expectedChange) throw expiryError;
            return null;
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
                
                const transformedPasskeys = await fetchMyAccountPasskeys(instance, account);
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
                if (requiresFullReauthentication(error)) {
                    cacheListOperation();
                    await handleReAuthentication();
                    break;
                }
                if (error instanceof InteractionRequiredAuthError) {
                    cacheListOperation();
                    onShowToast?.(createToastMessages.sessionExpiredWithAction(async () => {
                        try {
                            await redirectForMyAccountAccess(instance, account);
                        } catch (redirectError) {
                            setError(`Could not verify your identity: ${redirectError.message}`);
                        }
                    }));
                    break;
                }
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

        const requiresUserAction = lastError instanceof InteractionRequiredAuthError
            || requiresFullReauthentication(lastError);
        const errorMsg = requiresUserAction
            ? onShowToast
                ? 'Additional verification is required. Select Next in the security prompt to view your passkeys.'
                : 'Additional verification is required. Sign in again to view your passkeys.'
            : `Failed to load passkeys: ${lastError?.message || 'Unknown error'}`;
        setError(errorMsg);
        
        if (onShowToast && !requiresUserAction) {
            onShowToast(createToastMessages.errorLoading());
        }
        
        if (setLoadingState) {
            setIsLoading(false);
        }
        
        if (expectedChange) {
            throw lastError || new Error('Max retries exceeded');
        }
        
        return null;
    }, [instance, account, ngcmfaExpiry, onShowToast]);

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
