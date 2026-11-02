import { Button, Col, ListGroup, Row } from 'react-bootstrap';
import { FaLock } from 'react-icons/fa';
import { formatDetailedDate } from '../../utils/graphServiceUtils';

const PasswordCredential = ({ password, onChange, disabled = false }) => (
    <ListGroup.Item className="border-bottom py-3">
        <Row className="align-items-center g-3">
            <Col xs={12} sm={5}>
                <div className="d-flex align-items-center gap-3">
                    <FaLock className="text-muted" aria-hidden="true" />
                    <strong>Password</strong>
                </div>
            </Col>
            <Col xs={8} sm={5}>
                {password.lastUpdatedDateTime && (
                    <>
                        <small className="text-muted d-block">Last updated</small>
                        <span className="small">{formatDetailedDate(password.lastUpdatedDateTime)}</span>
                    </>
                )}
            </Col>
            <Col xs={4} sm={2} className="text-end">
                <Button
                    variant="link"
                    size="sm"
                    onClick={onChange}
                    disabled={disabled || !password.updateHref}
                    aria-label="Change password"
                    title={!password.updateHref ? 'Password changes are not available for this account.' : undefined}
                >
                    Change
                </Button>
            </Col>
        </Row>
    </ListGroup.Item>
);

export default PasswordCredential;
