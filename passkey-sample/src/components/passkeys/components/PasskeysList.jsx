import { ListGroup } from 'react-bootstrap';
import PasskeyItem from './PasskeyItem';
import PasswordCredential from '../../credentials/PasswordCredential';

const PasskeysList = ({ password, passkeys, onChangePassword, onDelete }) => {
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

export default PasskeysList;
