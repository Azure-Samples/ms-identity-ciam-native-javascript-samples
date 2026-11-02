import { Button } from 'react-bootstrap';
import { FaPlus } from 'react-icons/fa';

const PasskeysHeader = ({ count, maxCount, onAddClick, isLoading = false }) => {
    return (
        <Button
            variant="primary"
            size="sm"
            onClick={onAddClick}
            disabled={count >= maxCount || isLoading}
            title={count >= maxCount ? `You can register up to ${maxCount} passkeys.` : undefined}
        >
            <FaPlus className="me-1" />
            Add Passkey
        </Button>
    );
};

export default PasskeysHeader;
