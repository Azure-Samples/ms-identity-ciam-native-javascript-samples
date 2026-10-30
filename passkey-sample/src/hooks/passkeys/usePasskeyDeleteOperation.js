import { useState } from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { deleteSelfServicePasskey } from '../../services/selfServiceApiClient';
import { createToastMessages, requiresFullReauthentication } from '../../utils/passkeyUtils';
import { useAuthentication } from './useAuthentication';

const DELETION_PROPAGATION_DELAY = 2000;

export const usePasskeyDeleteOperation = ({ 
    instance,
    account,
    onShowToast, 
    fetchPasskeys,
    currentPasskeys 
}) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [passkeyToDelete, setPasskeyToDelete] = useState(null);
    
    const { requestVerification } = useAuthentication({ onShowToast });

    const displayModal = (passkey) => {
        setPasskeyToDelete(passkey);
        setShowDeleteModal(true);
    };

    const performDelete = async (passkeyId, cachedPasskeyName, cachedDeleteHref) => {
        const targetPasskey = currentPasskeys.find(p => p.id === passkeyId);
        const passkeyDisplayName = targetPasskey?.name || cachedPasskeyName;
        const deleteHref = targetPasskey?.deleteHref || cachedDeleteHref;

        try {
            await deleteSelfServicePasskey(instance, account, deleteHref);
        } catch (err) {
            const fullSignIn = requiresFullReauthentication(err);
            if (fullSignIn) {
                onShowToast?.(createToastMessages.errorDeleting(err.message));
            }
            if (fullSignIn || err instanceof InteractionRequiredAuthError) {
                await requestVerification({
                    action: 'delete',
                    passkey: {
                        ...targetPasskey,
                        id: passkeyId,
                        name: passkeyDisplayName,
                        deleteHref,
                    },
                }, account, fullSignIn, createToastMessages.errorDeleting);
                return;
            }
            onShowToast?.(createToastMessages.errorDeleting(err.message));
            return;
        }

        onShowToast?.(createToastMessages.passkeyDeleted(passkeyDisplayName || 'Unknown'));

        try {
            await new Promise(resolve => setTimeout(resolve, DELETION_PROPAGATION_DELAY));

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
        displayModal(passkey);
    };

    const confirm = async () => {
        if (!passkeyToDelete) return;

        const { id: passkeyId, name: passkeyName, deleteHref } = passkeyToDelete;
        
        hide();
        
        await performDelete(passkeyId, passkeyName, deleteHref);
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
