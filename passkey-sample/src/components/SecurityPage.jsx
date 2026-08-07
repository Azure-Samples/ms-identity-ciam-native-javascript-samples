import { useState, useEffect } from 'react';
import { Container, Alert, Spinner } from 'react-bootstrap';
import { FaBell } from 'react-icons/fa';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
import { calculateNgcmfaExpiration, getAccessToken } from '../utils/tokenUtils';

import { UserProfileHeader, SecurityAlert } from './common/UIComponents';
import ToastNotifications from './common/ToastNotifications';
import PasskeysSection from './passkeys/PasskeysSection';

const NGCMFA_EXPIRY_MINUTES = 15;
const SECONDS_PER_MINUTE = 60;

export const SecurityPage = () => {
    const { instance, accounts } = useMsal();
    const [accessToken, setAccessToken] = useState(null);
    const [ngcmfaExpiration, setNgcmfaExpiration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accessTokenError, setAccessTokenError] = useState(null);
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
        if (accessToken) {
            const expiration = calculateNgcmfaExpiration(accessToken, NGCMFA_EXPIRY_MINUTES, SECONDS_PER_MINUTE);
            setNgcmfaExpiration(expiration);
        } else {
            setNgcmfaExpiration(null);
        }
    }, [accessToken]);

    // ID token claims from the signed-in MSAL account. Unlike the access token
    // (which may be opaque / non-decodable for some resources), the ID token is
    // always a readable JWT, so we source the user's identity from here.
    const idTokenClaims = (accounts && accounts[0] && accounts[0].idTokenClaims) || null;

    const getUserId = () => {
        // Prefer the account's ID-token oid. Fall back to the access token's oid/sub
        // and finally 'me'. The SDK list call targets /me and does not need the real
        // oid; this just keeps the page from blocking when oid is absent.
        return (
            (idTokenClaims && (idTokenClaims.oid || idTokenClaims.sub)) ||
            (accessToken && (accessToken.oid || accessToken.sub)) ||
            (accounts && accounts[0] && accounts[0].localAccountId) ||
            'me'
        );
    };

    const getUserData = () => {
        const defaultUserData = {
            name: "User",
            email: "user@example.com",
        };

        const source = idTokenClaims || accessToken;
        if (source) {
            return {
                name: source.name || source.given_name || source.family_name || defaultUserData.name,
                email: source.preferred_username || source.unique_name || source.email || source.upn || defaultUserData.email,
            };
        }

        return defaultUserData;
    };

    const displayError = accessTokenError;
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
                <Alert variant="danger">
                    <Alert.Heading>
                        Authentication Error
                    </Alert.Heading>
                    <p>{displayError}</p>
                </Alert>
            </Container>
        );
    }

    // Temporarily disabled: the access token in this test setup may not carry an
    // `oid` claim. getUserId() now falls back to `sub`/'me', so this guard is no
    // longer needed. Kept (commented) for reference.
    // if (!userId) {
    //     return (
    //         <Container className="py-4">
    //             <Alert variant="warning">
    //                 <Alert.Heading>User ID Not Available</Alert.Heading>
    //                 <p>Unable to extract user ID from token claims. Please try logging in again.</p>
    //             </Alert>
    //         </Container>
    //     );
    // }

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
