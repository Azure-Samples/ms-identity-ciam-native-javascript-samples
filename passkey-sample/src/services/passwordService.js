import { getSelfServiceAccessToken } from '../utils/selfServiceToken';
import { METHODS_PATH, buildMethodUrl, requestMethod } from './selfServiceApiClient';

export function adaptSelfServicePassword(methods) {
    const password = methods.find((method) => method.type === 'password');
    if (password && !password.id) {
        throw new Error('The password method has no ID.');
    }
    return password ? {
        id: password.id,
        lastUpdatedDateTime: password.lastUpdatedDateTime,
        updateHref: password._links?.update?.href,
    } : null;
}

function validatePasswordLink(href, expectedPath) {
    const url = buildMethodUrl(href);
    if (url.pathname.slice(url.pathname.indexOf(METHODS_PATH)) !== expectedPath) {
        throw new Error('Invalid password method link.');
    }
}

async function requestPassword(path, method, token, body, signal) {
    const response = await requestMethod(path, method, token, body, {
        signal, redirect: 'error', cache: 'no-store',
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!data) throw new Error('The credential service returned an empty response.');
    return data;
}

function waitForPoll(seconds, signal) {
    return new Promise((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer);
            reject(signal.reason || new DOMException('Request cancelled.', 'AbortError'));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort);
            resolve();
        }, Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Number(seconds) * 1000 : 1000);
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
    });
}

export async function updateSelfServicePassword(
    instance, account, password, { currentPassword, newPassword }, { signal, onPending } = {}
) {
    if (!password?.id || !password.updateHref) throw new Error('Changing this password is not available.');
    if (typeof currentPassword !== 'string' || !currentPassword.trim() ||
        typeof newPassword !== 'string' || !newPassword.trim()) {
        throw new Error('Enter your current password and a new password.');
    }
    const path = `${METHODS_PATH}/password/${encodeURIComponent(password.id)}`;
    validatePasswordLink(password.updateHref, path);
    const token = await getSelfServiceAccessToken(instance, account);
    let result = await requestPassword(
        password.updateHref, 'PUT', token, { currentPassword, newPassword }, signal
    );
    let pending = false;
    while (result) {
        if (result.type !== 'password' || result.id !== password.id) {
            throw new Error('The credential service returned an unexpected password update.');
        }
        if (result.status === 'succeeded') return;
        if (!['notStarted', 'running'].includes(result.status) ||
            !result.continuationToken || !result._links?.pollUpdate?.href) {
            throw new Error('The credential service returned an invalid password update status.');
        }
        const pollHref = result._links.pollUpdate.href;
        validatePasswordLink(pollHref, `${path}/pollUpdate`);
        if (!pending) {
            pending = true;
            onPending?.();
        }
        await waitForPoll(result.pollInterval, signal);
        result = await requestPassword(
            pollHref, 'POST', token, { continuationToken: result.continuationToken }, signal
        );
    }
}
