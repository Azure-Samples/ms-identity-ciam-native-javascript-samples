import { useState } from 'react';
import { deleteUserPasskey } from '../../services/PasskeyService';
import { createToastMessages } from '../../utils/passkeyUtils';
import { useAuthentication } from './useAuthentication';

export const usePasskeyDeleteOperation = ({ 
    appToken, 
    userId, 
    ngcmfaExpiry, 
    onShowToast, 
    fetchPasskeys,
    currentPasskeys 
}) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [passkeyToDelete, setPasskeyToDelete] = useState(null);
    
    const { isTokenExpired, handleReAuthentication, cacheOperation } = useAuthentication({ onShowToast });

    const displayModal = (passkey) => {
        setPasskeyToDelete(passkey);
        setShowDeleteModal(true);
    };

    const performDelete = async (passkeyId, cachedPasskeyName) => {
        const targetPasskey = currentPasskeys.find(p => p.id === passkeyId);
        const passkeyDisplayName = targetPasskey?.name || cachedPasskeyName;

        try {
            await deleteUserPasskey(appToken, userId, passkeyId);
        } catch (err) {
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
            onConfirm: confirm,
            onCancel: hide
        }
    };
};
