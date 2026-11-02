import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
    const errors = {};
    if (!currentPassword.trim()) errors.currentPassword = 'Enter your current password.';
    if (!newPassword.trim()) errors.newPassword = 'Enter a new password.';
    if (!confirmPassword) errors.confirmPassword = 'Confirm your new password.';
    else if (confirmPassword !== newPassword) errors.confirmPassword = 'The new passwords do not match.';
    return errors;
}

const ChangePasswordModal = ({
    onClose, onSubmitPassword, onSuccess, onAuthenticationError = async () => false,
}) => {
    const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [errors, setErrors] = useState({});
    const [error, setError] = useState(null);
    const [phase, setPhase] = useState('idle');
    const request = useRef(null);

    useEffect(() => () => request.current?.abort(), []);

    const handleChange = ({ target: { name, value } }) => {
        setValues((previous) => ({ ...previous, [name]: value }));
        setErrors({});
        setError(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (phase !== 'idle') return;
        const validation = validatePasswordChange(values);
        setErrors(validation);
        if (Object.keys(validation).length) return;

        const controller = new AbortController();
        request.current = controller;
        setPhase('submitting');
        setError(null);
        try {
            await onSubmitPassword({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
            }, {
                signal: controller.signal,
                onPending: () => {
                    setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPhase('polling');
                },
            });
            if (!controller.signal.aborted) onSuccess();
        } catch (err) {
            if (controller.signal.aborted) return;
            if (await onAuthenticationError(err)) return;
            setError(err?.message || 'Your password could not be changed.');
        } finally {
            if (!controller.signal.aborted) setPhase('idle');
        }
    };

    const handleClose = () => {
        if (phase !== 'submitting') onClose(phase === 'polling');
    };

    return (
        <Modal show onHide={handleClose} centered
            backdrop={phase === 'submitting' ? 'static' : true}
            keyboard={phase !== 'submitting'}
            aria-labelledby="change-password-title"
        >
            <Modal.Header closeButton={phase !== 'submitting'}>
                <Modal.Title id="change-password-title">Change password</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit} noValidate>
                <Modal.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {phase === 'polling' ? (
                        <div role="status">
                            <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
                            Updating your password...
                            <p className="text-muted small mt-3 mb-0">
                                Closing this dialog stops waiting, but does not cancel the password change.
                                Refresh the page to check before trying again.
                            </p>
                        </div>
                    ) : (
                        <>
                            {[
                                ['currentPassword', 'Current password', 'current-password'],
                                ['newPassword', 'New password', 'new-password'],
                                ['confirmPassword', 'Confirm new password', 'new-password'],
                            ].map(([name, label, autoComplete]) => (
                                <Form.Group className="mb-3" controlId={`change-${name}`} key={name}>
                                    <Form.Label>{label}</Form.Label>
                                    <Form.Control
                                        type="password"
                                        name={name}
                                        value={values[name]}
                                        onChange={handleChange}
                                        autoComplete={autoComplete}
                                        autoFocus={name === 'currentPassword'}
                                        required
                                        disabled={phase !== 'idle'}
                                        isInvalid={Boolean(errors[name])}
                                        aria-invalid={Boolean(errors[name])}
                                        aria-describedby={errors[name] ? `change-${name}-error` : undefined}
                                    />
                                    <Form.Control.Feedback type="invalid" id={`change-${name}-error`}>
                                        {errors[name]}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            ))}
                            <p className="text-muted small mb-0">Your organization's password policy applies.</p>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose} disabled={phase === 'submitting'}>
                        {phase === 'polling' ? 'Close' : 'Cancel'}
                    </Button>
                    <Button variant="primary" type="submit" disabled={phase !== 'idle'}>
                        {phase !== 'idle' && (
                            <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
                        )}
                        {phase === 'idle' ? 'Change password' : 'Updating...'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

export default ChangePasswordModal;
