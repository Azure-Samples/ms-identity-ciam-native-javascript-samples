import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../../authConfig';
import { requestSelfServiceTokenAfterSignIn, redirectForSelfServiceAccess } from '../../utils/selfServiceToken';
import { createAuthenticationToastMessages } from '../../utils/authenticationUtils';

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
            requestSelfServiceTokenAfterSignIn();
            await instance.loginRedirect({
                ...loginRequest,
                loginHint: account?.username
            });
        } catch (error) {
            clearCachedOperation();
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
                onShowToast(createAuthenticationToastMessages.sessionExpiredWithAction(async () => {
                    cacheOperation({ action: 'list' });
                    await handleSignIn();
                }, clearCachedOperation));
            }
        } catch (error) {
            if (onShowToast) {
                onShowToast(createAuthenticationToastMessages.authError());
            }
        }
    };

    const cacheOperation = (operation) => {
        const pending = getCachedOperation();
        if (operation.action === 'list' && pending?.recoveryId && pending.action !== 'list') {
            return;
        }
        sessionStorage.setItem("postLoginAction", JSON.stringify({ ...operation, recoveryId: crypto.randomUUID() }));
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

    const requestVerification = async (operation, account, fullSignIn, createErrorToast) => {
        const verify = async () => {
            try {
                cacheOperation(operation);
                if (fullSignIn) {
                    await handleSignIn();
                } else {
                    await redirectForSelfServiceAccess(instance, account);
                }
            } catch (error) {
                clearCachedOperation();
                if (!onShowToast) throw error;
                onShowToast(createErrorToast(error.message));
            }
        };
        if (!onShowToast) {
            await verify();
            return;
        }
        onShowToast(createAuthenticationToastMessages.sessionExpiredWithAction(verify, clearCachedOperation));
    };

    return {
        handleSignIn,
        handleReAuthentication,
        requestVerification,
        cacheOperation,
        getCachedOperation,
        clearCachedOperation
    };
};
