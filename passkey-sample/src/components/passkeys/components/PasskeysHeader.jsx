import { Button } from 'react-bootstrap';
import { FaPlus } from 'react-icons/fa';

/**
 * Header component for passkeys section with count display and add button
 * @param {Object} props - Component props
 * @param {number} props.count - Current number of passkeys
 * @param {number} props.maxCount - Maximum allowed number of passkeys
 * @param {Function} props.onAddClick - Callback function when add button is clicked
 * @param {boolean} [props.isLoading=false] - Whether component is in loading state
 * @returns {JSX.Element} Rendered passkeys header
 */
const PasskeysHeader = ({ count, maxCount, onAddClick, isLoading = false }) => {
    return (
        <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
                <h5 className="mb-0">Passkeys ({count}/{maxCount})</h5>
            </div>
            <Button 
                variant="primary" 
                size="sm"
                onClick={onAddClick}
                disabled={count >= maxCount || isLoading}
            >
                <FaPlus className="me-1" />
                Add Passkey
            </Button>
        </div>
    );
};

export default PasskeysHeader;
