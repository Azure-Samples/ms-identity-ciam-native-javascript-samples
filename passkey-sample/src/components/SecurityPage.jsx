import { useState, useEffect } from 'react';
import { Container, Alert, Spinner } from 'react-bootstrap';
import { FaBell } from 'react-icons/fa';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
import { getAccessToken } from '../utils/tokenUtils';
import {
    acquireSelfServiceTokenAfterSignIn,
    isSelfServiceTokenAcquisitionAfterSignInPending
} from '../utils/selfServiceToken';

import { UserProfileHeader, SecurityAlert } from './common/UIComponents';
import ToastNotifications from './common/ToastNotifications';
import PasskeysSection from './passkeys/PasskeysSection';

export const SecurityPage = () => {
    const { instance, accounts } = useMsal();
    const account = instance.getActiveAccount() || accounts[0];
    const accountId = account?.homeAccountId;
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accessTokenError, setAccessTokenError] = useState(null);
    const [selfServiceTokenError, setSelfServiceTokenError] = useState(null);
    const [toasts, setToasts] = useState([]);


    useEffect(() => {
        const fetchAccessToken = async () => {
            try {
                const isAfterSignIn = isSelfServiceTokenAcquisitionAfterSignInPending();
                const result = await getAccessToken(
                    instance,
                    account ? [account] : [],
                    loginRequest,
                    isAfterSignIn
                );

                if (result.error) {
                    setAccessTokenError(result.error);
                    setAccessToken(null);
                    setLoading(false);
                } else {
                    setAccessTokenError(null);
                    setAccessToken(result.decodedToken);
                    try {
                        await acquireSelfServiceTokenAfterSignIn(instance, account);
                        setSelfServiceTokenError(null);
                    } catch (error) {
                        console.error('Failed to acquire the Self Service API token after sign-in:', error);
                        setSelfServiceTokenError(`Failed to acquire the Self Service API token: ${error.message}`);
                    }
                    setLoading(false);
                }
            } catch (error) {
                setAccessTokenError(`Failed to get access token: ${error.message}`);
                setAccessToken(null);
                setLoading(false);
            }
        };

        fetchAccessToken();
    // Account objects may be recreated when MSAL reads its cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instance, accountId]);

    const getUserData = () => {
        const defaultUserData = {
            name: "User",
            email: "user@example.com",
        };

        const claims = accessToken || account?.idTokenClaims;
        if (claims) {
            return {
                name: claims.name || claims.given_name || claims.family_name || defaultUserData.name,
                email: claims.unique_name || claims.email || claims.preferred_username || claims.upn || defaultUserData.email,
            };
        }

        return defaultUserData;
    };

    const userData = getUserData();

    const alerts = [
        {
            id: 1,
            message: "For your security, multi-factor authentication is required when managing your credentials",
            type: "info",
            icon: FaBell
        }
    ];

    const showToast = (toastData) => {
        setToasts(prev => {
            if (toastData.type === 'sessionExpiredWithAction' &&
                prev.some(toast => toast.type === 'sessionExpiredWithAction' && toast.show)) {
                return prev;
            }

            return [...prev, {
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                show: true,
                ...toastData
            }];
        });
    };

    const closeToast = (toastId) => {
        setToasts(prev => prev.filter(toast => toast.id !== toastId));
    };

    if (loading) {
        return (
            <Container className="py-4">
                <div className="d-flex justify-content-center">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </div>
            </Container>
        );
    }

    return (
        <Container className="py-4">
            <UserProfileHeader
                name={userData.name}
                email={userData.email}
            />

            {alerts.map(alert => (
                <SecurityAlert
                    key={alert.id}
                    message={alert.message}
                    type={alert.type}
                    icon={alert.icon}
                />
            ))}

            {accessTokenError && <Alert variant="warning">{accessTokenError}</Alert>}
            {selfServiceTokenError && <Alert variant="warning">{selfServiceTokenError}</Alert>}
            {!selfServiceTokenError && (
                <PasskeysSection
                    onShowToast={showToast}
                />
            )}

            {/* Toast Notifications */}
            <ToastNotifications
                toasts={toasts}
                onCloseToast={closeToast}
            />
        </Container>
    );
};

export default SecurityPage;
