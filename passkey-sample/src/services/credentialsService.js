import { fetchSelfServiceMethods } from './selfServiceApiClient';
import { adaptSelfServicePasskeys } from './passkeyService';
import { adaptSelfServicePassword } from './passwordService';

export async function fetchSelfServiceCredentials(instance, account) {
    const methods = await fetchSelfServiceMethods(instance, account, { cache: 'no-store' });
    const password = adaptSelfServicePassword(methods);
    return {
        passkeys: adaptSelfServicePasskeys(methods),
        password,
    };
}
