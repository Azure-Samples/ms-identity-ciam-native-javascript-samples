import { Button, Form, Modal } from 'react-bootstrap';

const AddPasskeyModal = ({ show, name, onNameChange, onConfirm, onCancel }) => (
    <Modal show={show} onHide={onCancel} centered>
        <Form onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
        }}>
            <Modal.Header closeButton>
                <Modal.Title>Add Passkey</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group controlId="passkey-name">
                    <Form.Label>Passkey name (optional)</Form.Label>
                    <Form.Control
                        type="text"
                        value={name}
                        onChange={event => onNameChange(event.target.value)}
                        placeholder="For example, My security key"
                        aria-describedby="passkey-name-help"
                        autoFocus
                    />
                    <Form.Text id="passkey-name-help">
                        Choose a name to recognize this passkey. Leave it blank to generate one automatically.
                    </Form.Text>
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button variant="primary" type="submit">Create Passkey</Button>
            </Modal.Footer>
        </Form>
    </Modal>
);

export default AddPasskeyModal;
