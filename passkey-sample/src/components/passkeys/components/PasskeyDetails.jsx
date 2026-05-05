import { Row, Col } from 'react-bootstrap';

/**
 * Dropdown details component for expanded passkey information
 * @param {Object} props - Component props
 * @param {Object} props.passkey - Passkey object containing detailed information
 * @returns {JSX.Element} Rendered passkey details
 */
const PasskeyDetails = ({ passkey }) => {
    return (
        <div className="mt-3 pt-3 border-top bg-light rounded p-3">
            {/* Two rows, two columns layout for expanded details */}
            <div className="flex-grow-1">
                <Row className="g-3 mb-2">
                    <Col xs={4} className="text-start">
                        <div>
                            <small className="text-muted d-block">Date Registered</small>
                            <span className="small">{passkey.created || 'N/A'}</span>
                        </div>
                    </Col>
                    <Col xs={8} className="text-start ps-3">
                        <div>
                            <small className="text-muted d-block">AAGUID</small>
                            <span className="small">
                                {passkey.aaGuid || 'N/A'}
                            </span>
                        </div>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default PasskeyDetails;
