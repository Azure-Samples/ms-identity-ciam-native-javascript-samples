import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { registerSelfServicePasskey } from '../../services/selfServiceApiClient';
import { redirectForSelfServiceAccess } from '../../utils/selfServiceToken';
import { createToastMessages } from '../../utils/passkeyUtils';
import { useAuthentication } from './useAuthentication';

const REGISTRATION_PROPAGATION_DELAY = 2000;

export const usePasskeyAddOperation = ({ 
    instance,
    account,
    ngcmfaExpiry,
    onShowToast, 
    fetchPasskeys,
    currentPasskeys 
}) => {
    const { isTokenExpired, handleReAuthentication, cacheOperation, clearCachedOperation } = useAuthentication({ onShowToast });

    const requestVerification = async () => {
        cacheOperation({ action: 'add' });
        if (!onShowToast) {
            await redirectForSelfServiceAccess(instance, account);
            return;
        }
        onShowToast(createToastMessages.sessionExpiredWithAction(async () => {
            try {
                await redirectForSelfServiceAccess(instance, account);
            } catch (error) {
                clearCachedOperation();
                onShowToast(createToastMessages.errorAdding(error.message));
            }
        }));
    };

    const performAddPasskey = async () => {
        const currentCount = currentPasskeys.length;
        
        try {
            if (!account) {
                throw new Error('Sign in before adding a passkey');
            }

            if (isTokenExpired(ngcmfaExpiry)) {
                cacheOperation({ action: 'add' });
                await handleReAuthentication();
                return;
            }

            await registerSelfServicePasskey(instance, account);
            
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
            if (err instanceof InteractionRequiredAuthError) {
                await requestVerification();
                return;
            }
            if (onShowToast) {
                if (err.name === 'NotAllowedError') {
                    onShowToast(createToastMessages.passkeyAddCancelled());
                } else {
                    onShowToast(createToastMessages.errorAdding(err.message));
                }
            }
            await fetchPasskeys();
        }
    };

    const handleAddPasskey = async () => {
        if (!account) {
            onShowToast?.(createToastMessages.errorAdding('Sign in before adding a passkey'));
            return;
        }
        await performAddPasskey();
    };

    return {
        handleAddPasskey,
        performAddPasskey
    };
};
