import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import { FaKey } from 'react-icons/fa';
import PasskeysHeader from './components/PasskeysHeader';
import PasskeysList from './components/PasskeysList';
import DeleteModal from './components/DeleteModal';
import AddPasskeyModal from './components/AddPasskeyModal';
import ChangePasswordModal from '../credentials/ChangePasswordModal';
import { updateSelfServicePassword } from '../../services/selfServiceApiClient';
import { PASSKEY_CONSTANTS, requiresFullReauthentication } from '../../utils/passkeyUtils';
import { 
    usePasskeyFetcher, 
    usePasskeyAddOperation, 
    usePasskeyDeleteOperation,
    useAuthentication
} from '../../hooks/passkeys';

const PasskeysSection = ({ onShowToast }) => {
    const { instance, accounts } = useMsal();
    const account = instance.getActiveAccount() || accounts[0];
    const accountId = account?.homeAccountId;
    const maxPasskeys = PASSKEY_CONSTANTS.MAX_PASSKEYS;
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const { passkeys, password, isLoading, error, fetchPasskeys } = usePasskeyFetcher({
        instance, account, onShowToast,
    });
    
    const { handleAddPasskey, performAddPasskey, isAdding, nameModalProps } = usePasskeyAddOperation({
        instance,
        account,
        onShowToast, 
        fetchPasskeys,
        currentPasskeys: passkeys
    });
    
    const { initiate: initiateDelete, showConfirmationModal, modalProps } = usePasskeyDeleteOperation({ 
        instance,
        account,
        onShowToast, 
        fetchPasskeys,
        currentPasskeys: passkeys
    });

    const { getCachedOperation, clearCachedOperation, requestVerification } = useAuthentication({ onShowToast });

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
        fetchPasskeys().then((result) => {
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

    useEffect(() => {
        if (!account) return;
        const operation = getCachedOperation();
        if (operation?.action === 'add' || operation?.action === 'delete') {
            return;
        }
        fetchPasskeys().then((result) => {
            if (result != null && getCachedOperation()?.action === 'list') clearCachedOperation();
        }).catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId]); // Account objects may be recreated when MSAL reads its cache.

    useEffect(() => {
        const operation = getCachedOperation();
        if (!operation || operation.action === 'list' || !account) return;
        if (operation.action === 'add') {
            clearCachedOperation();
            performAddPasskey(operation.displayName).catch(console.error);
        } else if (operation.action === 'delete' && operation.passkey) {
            clearCachedOperation();
            showConfirmationModal(operation.passkey);
        } else if (operation.action === 'changePassword' && !isLoading && !error) {
            clearCachedOperation();
            if (password?.updateHref) setShowPasswordModal(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId, isLoading, error, password]);

    const visiblePassword = !isLoading && !error ? password : null;
    const visiblePasskeys = !isLoading && !error ? passkeys : [];
    const isEmpty = !isLoading && !error &&
        !visiblePassword && visiblePasskeys.length === 0;

    return (
        <>
            <Card as="section" className="mb-4" aria-labelledby="credentials-heading">
                <Card.Body>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                        <h4 id="credentials-heading" className="mb-0">Credentials</h4>
                        <div className="d-flex flex-wrap gap-2">
                            {password && !error && (
                                <Button variant="primary" size="sm"
                                    disabled={isLoading || !password.updateHref}
                                    onClick={handleChangePassword}
                                >
                                    Change password
                                </Button>
                            )}
                            <PasskeysHeader
                                count={passkeys.length}
                                maxCount={maxPasskeys}
                                onAddClick={handleAddPasskey}
                                isLoading={isLoading || isAdding}
                            />
                        </div>
                    </div>
                    {error && (
                        <Alert variant="danger">
                            <Alert.Heading className="mb-1">Error loading credentials</Alert.Heading>
                            <p className="mb-0">{error}</p>
                        </Alert>
                    )}
                    <PasskeysList
                        password={visiblePassword}
                        passkeys={visiblePasskeys}
                        onChangePassword={handleChangePassword}
                        onDelete={initiateDelete}
                    />
                    {isLoading && (
                        <div role="status" className="text-muted text-center py-4">
                            <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
                            Loading credentials...
                        </div>
                    )}
                    {isEmpty && (
                        <div className="text-center py-5">
                            <FaKey size={48} className="text-muted opacity-50 mb-3" aria-hidden="true" />
                            <h6 className="text-muted mb-2">No credentials configured yet</h6>
                            <p className="text-muted small mb-0">Add a passkey to get started.</p>
                        </div>
                    )}
                </Card.Body>
            </Card>
            
            <AddPasskeyModal {...nameModalProps} />
            <DeleteModal {...modalProps} />
            {showPasswordModal && password && (
                <ChangePasswordModal
                    onClose={handlePasswordClose}
                    onSubmitPassword={(values, options) => (
                        updateSelfServicePassword(instance, account, password, values, options)
                    )}
                    onSuccess={handlePasswordChanged}
                    onAuthenticationError={handlePasswordAuthenticationError}
                />
            )}
        </>
    );
};

export default PasskeysSection;
