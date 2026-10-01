import { useState, useEffect } from 'react';
import { Container, Alert, Spinner } from 'react-bootstrap';
import { FaBell } from 'react-icons/fa';
import { useMsal } from '@azure/msal-react';
import { loginRequest, appConfig } from '../authConfig';
import { calculateNgcmfaExpiration, getAccessToken, getCachedAppToken } from '../utils/tokenUtils';

import { UserProfileHeader, SecurityAlert } from './common/UIComponents';
import ToastNotifications from './common/ToastNotifications';
import PasskeysSection from './passkeys/PasskeysSection';

const NGCMFA_EXPIRY_MINUTES = 15;
const SECONDS_PER_MINUTE = 60;

export const SecurityPage = () => {
    const { instance, accounts } = useMsal();
    const [accessToken, setAccessToken] = useState(null);
    const [appToken, setAppToken] = useState(null);
    const [ngcmfaExpiration, setNgcmfaExpiration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accessTokenError, setAccessTokenError] = useState(null);
    const [appTokenError, setAppTokenError] = useState(null);
    const [toasts, setToasts] = useState([]);


    useEffect(() => {
        const fetchAccessToken = async () => {
            try {
                const result = await getAccessToken(instance, accounts, loginRequest);

                if (result.error) {
                    setAccessTokenError(result.error);
                    setAccessToken(null);
                    setNgcmfaExpiration(null);
                    setLoading(false);
                } else {
                    setAccessTokenError(null);
                    setAccessToken(result.decodedToken);
                    setNgcmfaExpiration(calculateNgcmfaExpiration(result.decodedToken, NGCMFA_EXPIRY_MINUTES, SECONDS_PER_MINUTE));
                    setLoading(false);
                }
            } catch (error) {
                setAccessTokenError(`Failed to get access token: ${error.message}`);
                setAccessToken(null);
                setNgcmfaExpiration(null);
                setLoading(false);
            }
        };

        fetchAccessToken();
    }, [instance, accounts]);

    useEffect(() => {
        const fetchAppToken = async () => {
            try {
                const token = await getCachedAppToken(
                    instance, 
                    appConfig.proxyDomain, 
                    appConfig.appId, 
                    import.meta.env.VITE_APP_SECRET
                );
                
                if (token) {
                    setAppTokenError(null);
                    setAppToken(token);
                } else {
                    throw new Error('App token request returned empty result');
                }
            } catch (error) {
                setAppTokenError(`Failed to get app token: ${error.message}. Passkey functionality may be limited.`);
                setAppToken(null);
            }
        };

        if (instance) {
            fetchAppToken();
        }
    }, [instance]);

    const getUserId = () => {
        return accessToken?.oid || (instance.getActiveAccount() || accounts[0])?.idTokenClaims?.oid || null;
    };

    const getUserData = () => {
        const defaultUserData = {
            name: "User",
            email: "user@example.com",
        };

        const claims = accessToken || (instance.getActiveAccount() || accounts[0])?.idTokenClaims;
        if (claims) {
            return {
                name: claims.name || claims.given_name || claims.family_name || defaultUserData.name,
                email: claims.unique_name || claims.email || claims.preferred_username || claims.upn || defaultUserData.email,
            };
        }

        return defaultUserData;
    };

    const userData = getUserData();
    const userId = getUserId();

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
            {appTokenError && <Alert variant="warning">{appTokenError}</Alert>}
            <PasskeysSection
                onShowToast={showToast}
                appToken={appToken}
                userId={userId}
                ngcmfaExpiry={ngcmfaExpiration}
            />

            {/* Toast Notifications */}
            <ToastNotifications
                toasts={toasts}
                onCloseToast={closeToast}
            />
        </Container>
    );
};

export default SecurityPage;
