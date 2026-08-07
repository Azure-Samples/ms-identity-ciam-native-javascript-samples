import { useMsal } from '@azure/msal-react';
import { registerPasskeyViaSdk } from '../../services/credentialClient';
import { createToastMessages } from '../../utils/passkeyUtils';
import { clearCachedMyAccountApiToken, isNgcmfaReauthRequired } from '../../utils/myAccountToken';
import { useAuthentication } from './useAuthentication';

const REGISTRATION_PROPAGATION_DELAY = 2000;

export const usePasskeyAddOperation = ({ 
    userId, 
    ngcmfaExpiry, 
    onShowToast, 
    fetchPasskeys,
    currentPasskeys 
}) => {
    const { instance } = useMsal();
    const { isTokenExpired, handleReAuthentication, cacheOperation } = useAuthentication({ onShowToast });

    const performAddPasskey = async () => {
        const currentCount = currentPasskeys.length;
        
        try {
            if (!userId) {
                throw new Error('Missing userId');
            }

            // SDK two-step FIDO ceremony (begin -> navigator.credentials.create
            // -> activate). The SDK mints its own My Account API token, so no
            // appToken is required here.
            await registerPasskeyViaSdk(instance);
            
            if (onShowToast) {
                onShowToast(createToastMessages.passkeyAdded());
            }
            
            await new Promise(resolve => setTimeout(resolve, REGISTRATION_PROPAGATION_DELAY));
            
            await fetchPasskeys({
                type: 'add',
                expectedCount: currentCount + 1
            }, {
                setLoadingState: true,
                showToast: true
            });

        } catch (err) {
            // Reactive NGCMFA: if the token exchange reported that MFA expired
            // (AADSTS50078), clear the stale token B, cache the operation, and
            // trigger the existing re-auth popup. PasskeysSection replays the
            // cached 'add' after the redirect completes.
            if (isNgcmfaReauthRequired(err)) {
                clearCachedMyAccountApiToken();
                cacheOperation({ action: 'add' });
                await handleReAuthentication();
                return;
            }
            if (onShowToast) {
                if (err.name === 'NotAllowedError') {
                    onShowToast(createToastMessages.passkeyAddCancelled());
                } else {
                    onShowToast(createToastMessages.errorAdding(err.message));
                }
            }
        }
    };

    const handleAddPasskey = async () => {
        // NGCMFA is now enforced REACTIVELY. The proactive 15-minute timer below
        // is disabled in favour of catching AADSTS50078 from the actual token
        // exchange (see performAddPasskey's catch) so the re-auth popup only
        // appears when the server genuinely requires a fresh MFA.
        // if (isTokenExpired(ngcmfaExpiry)) {
        //     const addOperation = { action: 'add' };
        //     cacheOperation(addOperation);
        //     await handleReAuthentication();
        //     return;
        // }

        await performAddPasskey();
    };

    return {
        handleAddPasskey,
        performAddPasskey
    };
};
