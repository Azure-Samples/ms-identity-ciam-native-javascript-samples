import { useState } from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { updateSelfServicePassword } from '../../services/passwordService';
import { requiresFullReauthentication } from '../../utils/authenticationUtils';
import { useAuthentication } from '../common/useAuthentication';

export const usePasswordChangeOperation = ({ instance, account, password, onShowToast, fetchCredentials }) => {
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const { requestVerification } = useAuthentication({ onShowToast });

    const handlePasswordChanged = () => {
        setShowPasswordModal(false);
        onShowToast({
            title: 'Password updated',
            message: 'Your password was changed successfully.',
            variant: 'success',
        });
        const warnRefresh = () => onShowToast({
            title: 'Password updated',
            message: 'Your password was changed, but its details could not be refreshed.',
            variant: 'warning',
        });
        fetchCredentials().then((result) => {
            if (result == null) warnRefresh();
        }).catch(warnRefresh);
    };

    const handleChangePassword = () => setShowPasswordModal(true);

    const handlePasswordAuthenticationError = async (error) => {
        const fullSignIn = requiresFullReauthentication(error);
        if (fullSignIn || error instanceof InteractionRequiredAuthError) {
            setShowPasswordModal(false);
            await requestVerification({ action: 'changePassword' }, account, fullSignIn, (message) => ({
                title: 'Authentication error',
                message: `Could not verify your identity: ${message}`,
                variant: 'danger',
            }));
            return true;
        }
        return false;
    };

    const handlePasswordClose = (pending) => {
        setShowPasswordModal(false);
        if (pending) {
            onShowToast({
                title: 'Password update in progress',
                message: 'The change may still complete. Refresh the page to check before trying again.',
                variant: 'info',
            });
        }
    };

    return {
        showPasswordModal,
        handleChangePassword,
        modalProps: {
            onClose: handlePasswordClose,
            onSubmitPassword: (values, options) => (
                updateSelfServicePassword(instance, account, password, values, options)
            ),
            onSuccess: handlePasswordChanged,
            onAuthenticationError: handlePasswordAuthenticationError,
        },
    };
};
