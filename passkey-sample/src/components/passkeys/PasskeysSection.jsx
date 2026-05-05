import { useEffect } from 'react';
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

const PasskeysSection = ({ onShowToast, appToken, userId, ngcmfaExpiry }) => {
    const maxPasskeys = PASSKEY_CONSTANTS.MAX_PASSKEYS;

    // Custom hooks handle all the complex logic
    const { passkeys, isLoading, error, fetchPasskeys } = usePasskeyFetcher({ 
        appToken, userId, onShowToast 
    });
    
    const { handleAddPasskey, performAddPasskey } = usePasskeyAddOperation({ 
        appToken, 
        userId, 
        ngcmfaExpiry, 
        onShowToast, 
        fetchPasskeys,
        currentPasskeys: passkeys
    });
    
    const { initiate: initiateDelete, showConfirmationModal, modalProps } = usePasskeyDeleteOperation({ 
        appToken, 
        userId, 
        ngcmfaExpiry, 
        onShowToast, 
        fetchPasskeys,
        currentPasskeys: passkeys
    });

    const { getCachedOperation, clearCachedOperation } = useAuthentication({ onShowToast });

    // Handle initial fetch
    useEffect(() => {
        if (appToken && userId) {
            fetchPasskeys().catch(console.error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appToken, userId]); // Only depend on appToken and userId, not fetchPasskeys

    useEffect(() => {
        if (appToken && userId) {
            const operation = getCachedOperation();
            if (operation) {
                clearCachedOperation();
                
                if (operation.action === "add") {
                    performAddPasskey();
                } else if (operation.action === "delete" && operation.passkey) {
                    showConfirmationModal(operation.passkey);
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appToken, userId]);

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
