import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { deletePasskeyViaSdk } from '../../services/credentialClient';
import { createToastMessages } from '../../utils/passkeyUtils';
import { clearCachedMyAccountApiToken, isNgcmfaReauthRequired } from '../../utils/myAccountToken';
import { useAuthentication } from './useAuthentication';

export const usePasskeyDeleteOperation = ({ 
    userId, 
    ngcmfaExpiry, 
    onShowToast, 
    fetchPasskeys,
    currentPasskeys 
}) => {
    const { instance } = useMsal();
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
            // SDK delete (My Account API). The SDK mints its own My Account API
            // token, so no appToken is required here.
            await deletePasskeyViaSdk(instance, passkeyId);
            
            const updatedPasskeys = await fetchPasskeys({
                type: 'delete',
                passkeyId: passkeyId
            }, {
                setLoadingState: true,
                showToast: true
            });

            if (onShowToast && updatedPasskeys !== null) {
                onShowToast(createToastMessages.passkeyDeleted(passkeyDisplayName || 'Unknown'));
            }
        } catch (err) {
            // Reactive NGCMFA: if the token exchange reported that MFA expired
            // (AADSTS50078), clear the stale token B, cache the delete, and
            // trigger the existing re-auth popup. PasskeysSection replays the
            // cached 'delete' (reopening the confirm modal) after the redirect.
            if (isNgcmfaReauthRequired(err)) {
                clearCachedMyAccountApiToken();
                cacheOperation({
                    action: 'delete',
                    passkey: targetPasskey || { id: passkeyId, name: passkeyDisplayName },
                });
                await handleReAuthentication();
                return;
            }
            if (onShowToast) {
                onShowToast(createToastMessages.errorDeleting(err.message));
            }
        }
    };

    const initiate = async (passkey) => {
        // NGCMFA is now enforced REACTIVELY. The proactive 15-minute timer below
        // is disabled in favour of catching AADSTS50078 from the actual delete
        // token exchange (see performDelete's catch), so the confirm modal opens
        // immediately and the re-auth popup only appears if the server requires
        // a fresh MFA.
        // if (isTokenExpired(ngcmfaExpiry)) {
        //     const deleteOperation = {
        //         action: 'delete',
        //         passkey: passkey
        //     };
        //     cacheOperation(deleteOperation);
        //     await handleReAuthentication();
        //     return;
        // }

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
