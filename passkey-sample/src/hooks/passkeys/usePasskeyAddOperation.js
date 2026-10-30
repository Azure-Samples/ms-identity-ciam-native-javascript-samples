import { useState } from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { registerSelfServicePasskey } from '../../services/selfServiceApiClient';
import { createToastMessages, requiresFullReauthentication } from '../../utils/passkeyUtils';
import { useAuthentication } from './useAuthentication';

const REGISTRATION_PROPAGATION_DELAY = 2000;

export const usePasskeyAddOperation = ({ 
    instance,
    account,
    onShowToast, 
    fetchPasskeys,
    currentPasskeys 
}) => {
    const [showNameModal, setShowNameModal] = useState(false);
    const [passkeyName, setPasskeyName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const { requestVerification } = useAuthentication({ onShowToast });

    const performAddPasskey = async (displayName = '') => {
        if (isAdding) return;
        const currentCount = currentPasskeys.length;
        setIsAdding(true);
        
        try {
            try {
                if (!account) {
                    throw new Error('Sign in before adding a passkey');
                }

                await registerSelfServicePasskey(instance, account, displayName);
            } catch (err) {
                const fullSignIn = requiresFullReauthentication(err);
                if (fullSignIn) {
                    onShowToast?.(createToastMessages.errorAdding(err.message));
                }
                if (fullSignIn || err instanceof InteractionRequiredAuthError) {
                    await requestVerification(
                        { action: 'add', displayName }, account, fullSignIn, createToastMessages.errorAdding);
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
                return;
            }

            onShowToast?.(createToastMessages.passkeyAdded());

            try {
                await new Promise(resolve => setTimeout(resolve, REGISTRATION_PROPAGATION_DELAY));
                await fetchPasskeys({
                    type: 'add',
                    expectedCount: currentCount + 1
                }, {
                    setLoadingState: true,
                    showToast: true
                });
            } catch (refreshError) {
                console.warn('Passkey was added, but the passkey list could not be refreshed:', refreshError);
            }
        } finally {
            setIsAdding(false);
        }
    };

    const handleAddPasskey = async () => {
        if (!account) {
            onShowToast?.(createToastMessages.errorAdding('Sign in before adding a passkey'));
            return;
        }
        setPasskeyName('');
        setShowNameModal(true);
    };

    return {
        handleAddPasskey,
        performAddPasskey,
        isAdding,
        nameModalProps: {
            show: showNameModal,
            name: passkeyName,
            onNameChange: setPasskeyName,
            onCancel: () => setShowNameModal(false),
            onConfirm: async () => {
                setShowNameModal(false);
                await performAddPasskey(passkeyName.trim());
            },
        },
    };
};
