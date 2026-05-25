import { useMsal } from '@azure/msal-react';
import { clearAppTokenCache } from '../../utils/tokenUtils';
import { loginRequest } from '../../authConfig';
import { checkNgcmfaExpiration, createToastMessages } from '../../utils/passkeyUtils';

export const useAuthentication = ({ onShowToast }) => {
    const { instance } = useMsal();

    const handleSignIn = async () => {
        try {
            if (onShowToast) {
                onShowToast({
                    title: 'Redirecting...',
                    message: 'Signing out and redirecting to sign-in page...',
                    variant: 'info',
                    autoHide: true
                });
            }

            const account = instance.getAllAccounts()[0];
            clearAppTokenCache(instance);
            await instance.loginRedirect({
                ...loginRequest,
                loginHint: account?.username
            });
        } catch (error) {
            console.error('Error during sign-in redirect:', error);
            if (onShowToast) {
                onShowToast({
                    title: 'Authentication error',
                    message: 'Failed to redirect to sign-in page. Please try again.',
                    variant: 'danger'
                });
            }
        }
    };

    const handleReAuthentication = async () => {
        try {
            if (onShowToast) {
                onShowToast(createToastMessages.sessionExpiredWithAction(handleSignIn));
            }
        } catch (error) {
            if (onShowToast) {
                onShowToast(createToastMessages.authError());
            }
        }
    };

    const isTokenExpired = (ngcmfaExpiry) => {
        return checkNgcmfaExpiration(ngcmfaExpiry);
    };

    const cacheOperation = (operation) => {
        sessionStorage.setItem("postLoginAction", JSON.stringify(operation));
    };

    const getCachedOperation = () => {
        const actionData = sessionStorage.getItem("postLoginAction");
        if (actionData) {
            try {
                return JSON.parse(actionData);
            } catch (error) {
                sessionStorage.removeItem("postLoginAction");
                return null;
            }
        }
        return null;
    };

    const clearCachedOperation = () => {
        sessionStorage.removeItem("postLoginAction");
    };

    return {
        handleSignIn,
        handleReAuthentication,
        isTokenExpired,
        cacheOperation,
        getCachedOperation,
        clearCachedOperation
    };
};
