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

const PasskeysSection = ({ onShowToast, userId, ngcmfaExpiry }) => {
    const maxPasskeys = PASSKEY_CONSTANTS.MAX_PASSKEYS;

    // Custom hooks handle all the complex logic
    const { passkeys, isLoading, error, fetchPasskeys } = usePasskeyFetcher({ 
        userId, onShowToast 
    });
    
    const { handleAddPasskey, performAddPasskey } = usePasskeyAddOperation({ 
        userId, 
        ngcmfaExpiry, 
        onShowToast, 
        fetchPasskeys,
        currentPasskeys: passkeys
    });
    
    const { initiate: initiateDelete, showConfirmationModal, modalProps } = usePasskeyDeleteOperation({ 
        userId, 
        ngcmfaExpiry, 
        onShowToast, 
        fetchPasskeys,
        currentPasskeys: passkeys
    });

    const { getCachedOperation, clearCachedOperation } = useAuthentication({ onShowToast });

    // Handle initial fetch — list uses the SDK, which only needs the signed-in user.
    useEffect(() => {
        if (userId) {
            fetchPasskeys().catch(console.error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    useEffect(() => {
        if (userId) {
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
    }, [userId]);

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
