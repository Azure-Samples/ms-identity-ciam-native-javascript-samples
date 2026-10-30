import { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Card } from 'react-bootstrap';
import PasskeysHeader from './components/PasskeysHeader';
import PasskeysList from './components/PasskeysList';
import DeleteModal from './components/DeleteModal';
import { PASSKEY_CONSTANTS } from '../../utils/passkeyUtils';
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

    // Custom hooks handle all the complex logic
    const { passkeys, isLoading, error, fetchPasskeys } = usePasskeyFetcher({ instance, account, onShowToast });
    
    const { handleAddPasskey, performAddPasskey } = usePasskeyAddOperation({ 
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

    const { getCachedOperation, clearCachedOperation } = useAuthentication({ onShowToast });

    // Handle initial fetch
    useEffect(() => {
        if (!account) return;

        const operation = getCachedOperation();
        if (operation?.action === 'add' || operation?.action === 'delete') {
            return;
        }
        fetchPasskeys().then(result => {
            if (result != null && getCachedOperation()?.action === 'list') {
                clearCachedOperation();
            }
        }).catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId]); // Account objects may be recreated when MSAL reads its cache.

    useEffect(() => {
        const operation = getCachedOperation();
        if (!operation || operation.action === 'list' || !account) return;

        if (operation.action === 'add') {
            clearCachedOperation();
            performAddPasskey().catch(console.error);
        } else if (operation.action === 'delete' && operation.passkey) {
            clearCachedOperation();
            showConfirmationModal(operation.passkey);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId]);

    return (
        <>
            <Card className="mb-4">
                <Card.Body>
                    <PasskeysHeader 
                        count={passkeys.length} 
                        maxCount={maxPasskeys}
                        onAddClick={handleAddPasskey}
                        isLoading={isLoading}
                    />
                    <PasskeysList 
                        passkeys={passkeys} 
                        onDelete={initiateDelete}
                        isLoading={isLoading}
                        error={error}
                    />
                </Card.Body>
            </Card>
            
            <DeleteModal {...modalProps} />
        </>
    );
};

export default PasskeysSection;
