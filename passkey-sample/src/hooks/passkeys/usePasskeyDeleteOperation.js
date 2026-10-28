import { useState } from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { deleteSelfServicePasskey } from '../../services/selfServiceApiClient';
import { redirectForSelfServiceAccess } from '../../utils/selfServiceToken';
import { createToastMessages } from '../../utils/passkeyUtils';
import { useAuthentication } from './useAuthentication';

export const usePasskeyDeleteOperation = ({ 
    instance,
    account,
    ngcmfaExpiry, 
    onShowToast, 
    fetchPasskeys,
    currentPasskeys 
}) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [passkeyToDelete, setPasskeyToDelete] = useState(null);
    
    const { isTokenExpired, handleReAuthentication, cacheOperation, clearCachedOperation } = useAuthentication({ onShowToast });

    const displayModal = (passkey) => {
        setPasskeyToDelete(passkey);
        setShowDeleteModal(true);
    };

    const performDelete = async (passkeyId, cachedPasskeyName) => {
        const targetPasskey = currentPasskeys.find(p => p.id === passkeyId);
        const passkeyDisplayName = targetPasskey?.name || cachedPasskeyName;

        try {
            await deleteSelfServicePasskey(instance, account, passkeyId);
        } catch (err) {
            if (err instanceof InteractionRequiredAuthError) {
                cacheOperation({
                    action: 'delete',
                    passkey: { id: passkeyId, name: passkeyDisplayName }
                });
                const requestVerification = async () => {
                    try {
                        await redirectForSelfServiceAccess(instance, account);
                    } catch (error) {
                        clearCachedOperation();
                        onShowToast?.(createToastMessages.errorDeleting(error.message));
                        console.error('Self Service delete authorization failed:', error);
                    }
                };
                if (onShowToast) {
                    onShowToast(createToastMessages.sessionExpiredWithAction(requestVerification));
                } else {
                    await requestVerification();
                }
                return;
            }
            onShowToast?.(createToastMessages.errorDeleting(err.message));
            return;
        }

        onShowToast?.(createToastMessages.passkeyDeleted(passkeyDisplayName || 'Unknown'));

        try {
            await fetchPasskeys({
                type: 'delete',
                passkeyId: passkeyId
            }, {
                setLoadingState: true,
                showToast: false
            });
        } catch (refreshError) {
            console.warn('Passkey was deleted, but the passkey list could not be refreshed:', refreshError);
        }
    };

    const initiate = async (passkey) => {
        if (isTokenExpired(ngcmfaExpiry)) {
            const deleteOperation = { 
                action: 'delete', 
                passkey: passkey
            };
            cacheOperation(deleteOperation);
            await handleReAuthentication();
            return;
        }

        displayModal(passkey);
    };

    const confirm = async () => {
        if (!passkeyToDelete) return;

        const { id: passkeyId, name: passkeyName } = passkeyToDelete;
        
        hide();
        
        try {
            await performDelete(passkeyId, passkeyName);
        } catch (error) {
            // Error already handled in performDelete
        }
    };

    const hide = () => {
        setShowDeleteModal(false);
        setPasskeyToDelete(null);
    };

    return {
        initiate,
        performDelete,
        showConfirmationModal: displayModal,
        modalProps: {
            show: showDeleteModal,
            passkey: passkeyToDelete,
            api: 'selfService',
            onConfirm: confirm,
            onCancel: hide
        }
    };
};
