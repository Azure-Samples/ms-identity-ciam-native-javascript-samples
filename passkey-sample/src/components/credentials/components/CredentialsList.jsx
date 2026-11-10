import { ListGroup } from 'react-bootstrap';
import PasskeyItem from '../../passkeys/components/PasskeyItem';
import PasswordCredential from '../../password/PasswordCredential';

const CredentialsList = ({ password, passkeys, onChangePassword, onDelete }) => {
    return (
        <ListGroup variant="flush">
            {password && <PasswordCredential password={password} onChange={onChangePassword} />}
            {passkeys.map(passkey => (
                <PasskeyItem 
                    key={passkey.id} 
                    passkey={passkey} 
                    onDelete={onDelete}
                />
            ))}
        </ListGroup>
    );
};

export default CredentialsList;
