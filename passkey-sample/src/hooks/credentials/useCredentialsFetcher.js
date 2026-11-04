import { useState, useCallback, useEffect, useRef } from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { fetchSelfServiceCredentials } from '../../services/credentialsService';
import { redirectForSelfServiceAccess } from '../../utils/selfServiceToken';
import { createRetryDelay, createFetchDelay, createCredentialToastMessages } from '../../utils/credentialUtils';
import { createAuthenticationToastMessages, requiresFullReauthentication } from '../../utils/authenticationUtils';
import { useAuthentication } from '../common/useAuthentication';

/**
 * Hook for managing shared credential discovery with retry logic
 * @param {Object} params - Hook parameters
 * @param {Object} params.instance - MSAL instance
 * @param {Object} params.account - Signed-in account
 * @param {Function} params.onShowToast - Toast notification function
 * @returns {Object} Credential data and fetching utilities
 */
export const useCredentialsFetcher = ({ instance, account, onShowToast }) => {
    const accountId = account?.homeAccountId;
    const [credentials, setCredentials] = useState({ accountId: null, passkeys: [], password: null });
    const currentAccount = useRef(accountId);
    const latestFetch = useRef(0);
    currentAccount.current = accountId;
    useEffect(() => () => { latestFetch.current += 1; }, []);
    const passkeys = credentials.accountId === accountId ? credentials.passkeys : [];
    const password = credentials.accountId === accountId ? credentials.password : null;
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { handleReAuthentication, cacheOperation, clearCachedOperation } = useAuthentication({ onShowToast });

    const fetchCredentials = useCallback(async (options = {}) => {
        const fetchId = ++latestFetch.current;
        const isCurrent = () => latestFetch.current === fetchId && currentAccount.current === accountId;
        const { 
            maxRetries = 1,
            isExpectedResult,
            throwOnError = false,
            setLoadingState = true,
        } = options;

        if (!account) {
            setError('Sign in to view your credentials');
            if (setLoadingState) setIsLoading(false);
            return;
        }

        let lastError;
        
        if (setLoadingState) {
            setIsLoading(true);
            setError(null);
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (!isCurrent()) return null;
            try {
                if (maxRetries > 1) {
                    console.log(`Fetch attempt ${attempt}/${maxRetries}...`);
                }
                
                const result = await fetchSelfServiceCredentials(instance, account);
                if (!isCurrent()) return null;

                if (isExpectedResult && !isExpectedResult(result) && attempt < maxRetries) {
                    await createRetryDelay(attempt);
                    continue;
                }
                
                setCredentials({ ...result, accountId });
                console.log('Successfully updated credentials');
                
                if (setLoadingState) {
                    setIsLoading(false);
                }
                
                return result;
                
            } catch (error) {
                if (!isCurrent()) return null;
                lastError = error;
                if (requiresFullReauthentication(error)) {
                    await handleReAuthentication();
                    break;
                }
                if (error instanceof InteractionRequiredAuthError) {
                    onShowToast?.(createAuthenticationToastMessages.sessionExpiredWithAction(async () => {
                        try {
                            cacheOperation({ action: 'list' });
                            await redirectForSelfServiceAccess(instance, account);
                        } catch (redirectError) {
                            clearCachedOperation();
                            setError(`Could not verify your identity: ${redirectError.message}`);
                        }
                    }, clearCachedOperation));
                    break;
                }
                if (maxRetries > 1) {
                    console.warn(`Fetch attempt ${attempt} failed:`, error);
                } else {
                    console.error('Error fetching credentials:', error);
                }
                
                if (attempt < maxRetries) {
                    await createFetchDelay(attempt);
                }
            }
        }

        if (!isCurrent()) return null;
        const requiresUserAction = lastError instanceof InteractionRequiredAuthError
            || requiresFullReauthentication(lastError);
        const errorMsg = requiresUserAction
            ? onShowToast
                ? 'Additional verification is required. Select Next in the security prompt to view your credentials.'
                : 'Additional verification is required. Sign in again to view your credentials.'
            : `Failed to load credentials: ${lastError?.message || 'Unknown error'}`;
        setError(errorMsg);
        
        if (onShowToast && !requiresUserAction) {
            onShowToast(createCredentialToastMessages.errorLoading());
        }
        
        if (setLoadingState) {
            setIsLoading(false);
        }
        
        if (throwOnError) {
            throw lastError || new Error('Max retries exceeded');
        }
        
        return null;
    }, [instance, account, accountId, onShowToast]);

    const refetch = useCallback(() => {
        return fetchCredentials();
    }, [fetchCredentials]);

    return {
        passkeys,
        password,
        isLoading,
        error,
        fetchCredentials,
        refetch
    };
};
