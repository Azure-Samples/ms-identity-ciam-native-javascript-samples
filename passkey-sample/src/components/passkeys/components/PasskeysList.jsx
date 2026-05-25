import { ListGroup, Alert, Spinner } from 'react-bootstrap';
import { FaKey, FaExclamationTriangle } from 'react-icons/fa';
import PasskeyItem from './PasskeyItem';

/**
 * List component for displaying multiple passkeys with loading and error states
 * @param {Object} props - Component props
 * @param {Array} props.passkeys - Array of passkey objects to display
 * @param {Function} props.onDelete - Callback function when a passkey is deleted
 * @param {boolean} [props.isLoading=false] - Whether list is in loading state
 * @param {string|null} [props.error=null] - Error message to display if any
 * @returns {JSX.Element} Rendered passkeys list
 */
const PasskeysList = ({ passkeys, onDelete, isLoading = false, error = null }) => {
    if (error) {
        return (
            <Alert variant="danger" className="mb-0">
                <div className="d-flex align-items-center">
                    <FaExclamationTriangle className="me-2" />
                    <div>
                        <Alert.Heading className="mb-1">Error loading passkeys</Alert.Heading>
                        <p className="mb-0">{error}</p>
                    </div>
                </div>
            </Alert>
        );
    }

    if (isLoading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" role="status" className="mb-3" variant="primary">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p className="text-muted mb-0">Loading your passkeys...</p>
            </div>
        );
    }

    if (passkeys.length === 0) {
        return (
            <div className="text-center py-5">
                <div className="mb-3">
                    <FaKey size={48} className="text-muted opacity-50" />
                </div>
                <h6 className="text-muted mb-2">No passkeys configured yet</h6>
                <p className="text-muted small mb-0">
                    Create a passkey to sign in faster and more securely
                </p>
            </div>
        );
    }

    return (
        <ListGroup variant="flush">
            {passkeys.map(passkey => (
                <PasskeyItem 
                    key={passkey.id} 
                    passkey={passkey} 
                    onDelete={onDelete}
                    isLoading={isLoading}
                />
            ))}
        </ListGroup>
    );
};

export default PasskeysList;
