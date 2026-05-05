import { useState } from 'react';
import { Button, ListGroup, Collapse, Row, Col } from 'react-bootstrap';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { HiOutlineTrash } from 'react-icons/hi';
import PasskeyDetails from './PasskeyDetails';
import { parseDeviceModel } from './utils';

/**
 * Individual passkey item component for displaying passkey information
 * @param {Object} props - Component props
 * @param {Object} props.passkey - Passkey object containing id, name, model, created, lastUsed
 * @param {Function} props.onDelete - Callback function when delete button is clicked
 * @param {boolean} [props.isLoading=false] - Whether component is in loading state
 * @returns {JSX.Element} Rendered passkey item
 */
const PasskeyItem = ({ passkey, onDelete, isLoading = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleToggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const deviceDetails = parseDeviceModel(passkey.model);
    
    return (
        <ListGroup.Item className="passkey-item border-bottom" style={{ borderColor: '#e9ecef', borderWidth: '1px' }}>
            {/* Main Row - always visible */}
            <div className="d-flex justify-content-between align-items-center">
                {/* Two rows, two columns content area */}
                <div className="flex-grow-1">
                    <Row className="g-2 mb-1">
                        <Col xs={6} className="text-start">
                            <strong>Passkey ({passkey.passkeyType})</strong>
                        </Col>
                        <Col xs={6} className="text-start">
                            <span className="text-muted small">{deviceDetails.authenticatorDevice} - {deviceDetails.method}</span>
                        </Col>
                    </Row>
                    <Row className="g-2">
                        <Col xs={6} className="text-start">
                            <small className="text-muted">{deviceDetails.authenticatorDevice}</small>
                        </Col>
                        <Col xs={6} className="text-start">
                            <small className="text-muted">{deviceDetails.method} device</small>
                        </Col>
                    </Row>
                </div>
                
                {/* Buttons: Delete first, then Dropdown */}
                <div className="d-flex align-items-center gap-2">
                    <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent expanding when clicking delete
                            onDelete(passkey);
                        }}
                        disabled={isLoading}
                    >
                        <HiOutlineTrash />
                    </Button>
                    <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={handleToggleExpand}
                        className="border-0"
                    >
                        {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                    </Button>
                </div>
            </div>

            {/* Expandable Details */}
            <Collapse in={isExpanded}>
                <div>
                    <PasskeyDetails passkey={passkey} />
                </div>
            </Collapse>
        </ListGroup.Item>
    );
};

export default PasskeyItem;
