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
                    setLoading(false);
                } else {
                    setAccessTokenError(null);
                    setAccessToken(result.decodedToken);
                    setLoading(false);
                }
            } catch (error) {
                setAccessTokenError(`Failed to get access token: ${error.message}`);
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
    }, [instance, accessToken]);

    useEffect(() => {
        if (accessToken) {
            const expiration = calculateNgcmfaExpiration(accessToken, NGCMFA_EXPIRY_MINUTES, SECONDS_PER_MINUTE);
            setNgcmfaExpiration(expiration);
        } else {
            setNgcmfaExpiration(null);
        }
    }, [accessToken]);

    const getUserId = () => {
        if (accessToken && accessToken.oid) {
            return accessToken.oid;
        }
        return null;
    };

    const getUserData = () => {
        const defaultUserData = {
            name: "User",
            email: "user@example.com",
        };

        if (accessToken) {
            return {
                name: accessToken.name || accessToken.given_name || accessToken.family_name || defaultUserData.name,
                email: accessToken.unique_name || accessToken.email || accessToken.preferred_username || accessToken.upn || defaultUserData.email,
            };
        }

        return defaultUserData;
    };

    const displayError = accessTokenError || appTokenError;
    const userData = !loading && !accessTokenError ? getUserData() : { name: "Loading...", email: "Loading..." };
    const userId = !loading && !accessTokenError ? getUserId() : null;

    const alerts = [
        {
            id: 1,
            message: "For your security, multi-factor authentication is required when managing your credentials",
            type: "info",
            icon: FaBell
        }
    ];

    const showToast = (toastData) => {
        // Check if this is a sessionExpiredWithAction toast and if one already exists
        if (toastData.type === 'sessionExpiredWithAction') {
            const existingSessionExpiredToast = toasts.find(
                toast => toast.type === 'sessionExpiredWithAction' && toast.show
            );
            
            // If a session expired toast is already showing, don't add another one
            if (existingSessionExpiredToast) {
                return;
            }
        }

        const newToast = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            show: true,
            ...toastData
        };
        setToasts(prev => [...prev, newToast]);
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

    if (displayError) {
        return (
            <Container className="py-4">
                <Alert variant={accessTokenError ? "danger" : "warning"}>
                    <Alert.Heading>
                        {accessTokenError ? "Authentication Error" : "Service Error"}
                    </Alert.Heading>
                    <p>{displayError}</p>
                    {accessTokenError && appTokenError && (
                        <>
                            <hr />
                            <p><strong>Additional issue:</strong> {appTokenError}</p>
                        </>
                    )}
                </Alert>
            </Container>
        );
    }

    if (!userId) {
        return (
            <Container className="py-4">
                <Alert variant="warning">
                    <Alert.Heading>User ID Not Available</Alert.Heading>
                    <p>Unable to extract user ID from token claims. Please try logging in again.</p>
                </Alert>
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
