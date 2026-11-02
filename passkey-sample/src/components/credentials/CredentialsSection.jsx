import { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Alert, Card, Spinner } from 'react-bootstrap';
import { FaKey } from 'react-icons/fa';
import PasskeysHeader from '../passkeys/components/PasskeysHeader';
import CredentialsList from './components/CredentialsList';
import DeleteModal from '../passkeys/components/DeleteModal';
import AddPasskeyModal from '../passkeys/components/AddPasskeyModal';
import ChangePasswordModal from '../password/ChangePasswordModal';
import { PASSKEY_CONSTANTS } from '../../utils/passkeyUtils';
import { useAuthentication } from '../../hooks/common/useAuthentication';
import { useCredentialsFetcher } from '../../hooks/credentials/useCredentialsFetcher';
import { usePasswordChangeOperation } from '../../hooks/password/usePasswordChangeOperation';
import { 
    usePasskeyAddOperation, 
    usePasskeyDeleteOperation
} from '../../hooks/passkeys';

const CredentialsSection = ({ onShowToast }) => {
    const { instance, accounts } = useMsal();
    const account = instance.getActiveAccount() || accounts[0];
    const accountId = account?.homeAccountId;
    const maxPasskeys = PASSKEY_CONSTANTS.MAX_PASSKEYS;
    const { passkeys, password, isLoading, error, fetchCredentials } = useCredentialsFetcher({
        instance, account, onShowToast,
    });
    
    const { handleAddPasskey, performAddPasskey, isAdding, nameModalProps } = usePasskeyAddOperation({
        instance,
        account,
        onShowToast, 
        fetchCredentials,
        currentPasskeys: passkeys
    });
    
    const { initiate: initiateDelete, showConfirmationModal, modalProps } = usePasskeyDeleteOperation({ 
        instance,
        account,
        onShowToast, 
        fetchCredentials,
        currentPasskeys: passkeys
    });

    const { showPasswordModal, handleChangePassword, modalProps: passwordModalProps } = usePasswordChangeOperation({
        instance, account, password, onShowToast, fetchCredentials,
    });

    const { getCachedOperation, clearCachedOperation } = useAuthentication({ onShowToast });

    useEffect(() => {
        if (!account) return;
        const operation = getCachedOperation();
        if (operation?.action === 'add' || operation?.action === 'delete') {
            return;
        }
        fetchCredentials().then((result) => {
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
            if (password?.updateHref) handleChangePassword();
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
                    <CredentialsList
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
                <ChangePasswordModal {...passwordModalProps} />
            )}
        </>
    );
};

export default CredentialsSection;
