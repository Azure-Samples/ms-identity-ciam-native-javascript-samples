import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

class InteractionRequiredAuthError extends Error {}

async function loadModule(path, dependencies, globals = {}) {
    const context = createContext({ URL, console, ...globals });
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const module = new SourceTextModule(source, { context });
    await module.link(specifier => {
        const exports = dependencies[specifier];
        assert.ok(exports, `Unexpected dependency: ${specifier}`);
        return new SyntheticModule(Object.keys(exports), function () {
            for (const [name, value] of Object.entries(exports)) {
                this.setExport(name, value);
            }
        }, { context });
    });
    await module.evaluate();
    return module.namespace;
}

async function loadService(fetch) {
    const instance = {};
    const account = { homeAccountId: 'test-account' };
    const tokenRequests = [];
    const service = await loadModule('../src/services/selfServiceApiClient.js', {
        '../authConfig': {
            selfServiceApiConfig: {
                authority: 'https://self-service.example.test/tenant',
                apiQueryParams: { test: 'true' },
            },
        },
        '../utils/selfServiceToken': {
            getSelfServiceAccessToken: async (...args) => {
                tokenRequests.push(args);
                return 'test-access-token';
            },
        },
        '../utils/graphServiceUtils': {
            base64urlToBuffer() {},
            bufferToBase64url() {},
            formatDetailedDate: value => value,
            formatPasskeyType: value => value,
            generateUniquePasskeyName() {},
        },
    }, { fetch });
    return { service, instance, account, tokenRequests };
}

test('List preserves the advertised action and Delete uses the delegated token without a body', async () => {
    const requests = [];
    const deleteHref = 'https://login.example.test/tenant/api/v1.0/me/methods/fido/passkey-1';
    const { service, instance, account, tokenRequests } = await loadService(async (url, options) => {
        requests.push({ url, options });
        if (options.method === 'GET') {
            return {
                ok: true,
                json: async () => ({
                    _embedded: { methods: [
                        { id: 'passkey-1', type: 'fido', _links: { delete: { href: deleteHref } } },
                        { id: 'passkey-2', type: 'fido' },
                    ] },
                }),
            };
        }
        return { ok: true, status: 204 };
    });

    const passkeys = await service.fetchSelfServicePasskeys(instance, account);
    assert.equal(passkeys[0].deleteHref, deleteHref);
    assert.equal(passkeys[0].canDelete, true);
    assert.equal(passkeys[1].canDelete, false);
    await service.deleteSelfServicePasskey(instance, account, passkeys[0].deleteHref);

    assert.deepEqual(tokenRequests, [[instance, account], [instance, account]]);
    assert.equal(requests[1].url.href,
        'https://self-service.example.test/tenant/api/v1.0/me/methods/fido/passkey-1?test=true');
    assert.equal(requests[1].options.method, 'DELETE');
    assert.equal(requests[1].options.headers.Authorization, 'Bearer test-access-token');
    assert.equal(Object.hasOwn(requests[1].options, 'body'), false);
});

test('Delete rejects a missing action before requesting a token or calling the API', async () => {
    const { service, instance, account, tokenRequests } = await loadService(() => {
        assert.fail('Unexpected API request');
    });
    await assert.rejects(service.deleteSelfServicePasskey(instance, account, undefined),
        /cannot be deleted/);
    assert.equal(tokenRequests.length, 0);
});

test('Delete propagates API failure rather than reporting success', async () => {
    const { service, instance, account } = await loadService(async () => ({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: { message: 'Deletion denied' } }),
    }));
    await assert.rejects(service.deleteSelfServicePasskey(
        instance, account, '/api/v1.0/me/methods/fido/passkey-1'), /Deletion denied/);
});

test('Expired-token API responses retain HTTP status for verification recovery', async () => {
    for (const body of [
        JSON.stringify({ error: { message: 'Token expired' } }),
        'Unauthorized',
    ]) {
        const { service, instance, account } = await loadService(async () => ({
            ok: false, status: 401, text: async () => body,
        }));
        await assert.rejects(service.deleteSelfServicePasskey(
            instance, account, '/api/v1.0/me/methods/fido/passkey-1'), error => {
            assert.equal(error.status, 401);
            assert.match(error.message, /Token expired|HTTP 401/);
            return true;
        });
    }
});

async function loadDeleteHook(deleteMethod, currentPasskeys = [], setTimeout = callback => callback(), options = {}) {
    const state = [];
    let cursor = 0;
    const storage = new Map();
    const calls = [];
    const account = { homeAccountId: 'test-account' };
    const instance = {
        getAllAccounts: () => [account],
        loginRedirect: async () => { calls.push(['sign-in']); },
    };
    const utils = await loadModule('../src/utils/passkeyUtils.js', {});
    const auth = await loadModule('../src/hooks/passkeys/useAuthentication.js', {
        '@azure/msal-react': { useMsal: () => ({ instance }) },
        '../../authConfig': { loginRequest: {} },
        '../../utils/selfServiceToken': {
            requestSelfServiceTokenAfterSignIn() {},
            redirectForSelfServiceAccess: async () => {
                calls.push(['redirect']);
                if (options.redirectError) throw options.redirectError;
            },
        },
        '../../utils/passkeyUtils': utils,
    }, {
        sessionStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: key => storage.delete(key),
        },
    });
    const hook = await loadModule('../src/hooks/passkeys/usePasskeyDeleteOperation.js', {
        '@azure/msal-browser': { InteractionRequiredAuthError },
        react: {
            useState(initial) {
                const index = cursor++;
                if (!(index in state)) state[index] = initial;
                return [state[index], value => { state[index] = value; }];
            },
        },
        '../../services/selfServiceApiClient': {
            deleteSelfServicePasskey: async (...args) => {
                calls.push(['delete', ...args]);
                await deleteMethod(...args);
            },
        },
        '../../utils/passkeyUtils': {
            requiresFullReauthentication: utils.requiresFullReauthentication,
            createToastMessages: {
                passkeyDeleted: name => ({ type: 'deleted', name }),
                errorDeleting: message => ({ type: 'error', message }),
                sessionExpiredWithAction: utils.createToastMessages.sessionExpiredWithAction,
            },
        },
        './useAuthentication': auth,
    }, { setTimeout });
    return {
        instance,
        account,
        calls,
        get pendingOperation() {
            const value = storage.get('postLoginAction');
            return value ? JSON.parse(value) : undefined;
        },
        render() {
            cursor = 0;
            return hook.usePasskeyDeleteOperation({
                instance, account, currentPasskeys,
                onShowToast: toast => calls.push(['toast', toast]),
                fetchPasskeys: async (...args) => {
                    calls.push(['refresh', ...args]);
                    if (options.refreshError) throw options.refreshError;
                },
            });
        },
    };
}

test('Confirmation calls delegated Delete with the selected action, then refreshes List', async () => {
    const harness = await loadDeleteHook(async () => {});
    const passkey = { id: 'passkey-1', name: 'Test passkey', deleteHref: '/api/v1.0/me/methods/fido/passkey-1' };
    await harness.render().initiate(passkey);
    assert.equal(harness.calls.length, 0);
    const confirmation = harness.render();
    assert.equal(confirmation.modalProps.show, true);
    await confirmation.modalProps.onConfirm();
    assert.deepEqual(harness.calls[0],
        ['delete', harness.instance, harness.account, passkey.deleteHref]);
    assert.equal(harness.calls[1][1].type, 'deleted');
    assert.equal(harness.calls[2][0], 'refresh');
    assert.equal(harness.calls[2][1].type, 'delete');
    assert.equal(harness.calls[2][1].passkeyId, passkey.id);
    assert.equal(harness.render().modalProps.show, false);
});

test('A failed delegated Delete shows an error without a success toast or List refresh', async () => {
    const harness = await loadDeleteHook(async () => {
        throw Object.assign(new Error('Deletion denied'), { status: 403 });
    });
    await harness.render().performDelete('passkey-1', 'Test passkey', '/api/v1.0/me/methods/fido/passkey-1');
    assert.equal(harness.calls.length, 2);
    assert.equal(harness.calls[1][1].type, 'error');
    assert.equal(harness.calls[1][1].message, 'Deletion denied');
    assert.equal(harness.pendingOperation, undefined);
});

test('Delete verification failures preserve the target and offer Next without a List preflight', async () => {
    for (const [error, redirect] of [
        [new InteractionRequiredAuthError('Interaction required'), 'redirect'],
        [new Error('AADSTS7006105: Downstream token acquisition failed'), 'sign-in'],
        [Object.assign(new Error('Token expired'), { status: 401 }), 'sign-in'],
    ]) {
        const harness = await loadDeleteHook(async () => { throw error; });
        const passkey = {
            id: 'passkey-1', name: 'Test passkey',
            deleteHref: '/api/v1.0/me/methods/fido/passkey-1',
        };
        await harness.render().initiate(passkey);
        assert.equal(harness.calls.length, 0);
        const confirmation = harness.render();
        assert.equal(confirmation.modalProps.show, true);
        await confirmation.modalProps.onConfirm();
        assert.equal(harness.render().modalProps.show, false);
        assert.deepEqual(JSON.parse(JSON.stringify(harness.pendingOperation)), {
            action: 'delete', passkey,
        });
        assert.equal(harness.calls.length, error instanceof InteractionRequiredAuthError ? 2 : 3);
        assert.equal(harness.calls[0][0], 'delete');
        const toast = harness.calls.find(([type, value]) =>
            type === 'toast' && value.type === 'sessionExpiredWithAction')[1];
        assert.equal(toast.type, 'sessionExpiredWithAction');
        assert.equal(toast.action.label, 'Next');
        if (!(error instanceof InteractionRequiredAuthError)) {
            assert.equal(harness.calls[1][1].type, 'error');
            assert.equal(harness.calls[1][1].message, error.message);
        }
        await toast.action.onClick();
        assert.equal(harness.calls.some(([type]) => type === redirect), true);
    }
});

test('A failed verification redirect clears pending Delete and surfaces the error', async () => {
    const harness = await loadDeleteHook(async () => {
        throw new InteractionRequiredAuthError('Interaction required');
    }, [], callback => callback(), { redirectError: new Error('Redirect unavailable') });
    await harness.render().performDelete(
        'passkey-1', 'Test passkey', '/api/v1.0/me/methods/fido/passkey-1');
    await harness.calls[1][1].action.onClick();
    assert.equal(harness.pendingOperation, undefined);
    assert.equal(harness.calls[3][1].type, 'error');
    assert.equal(harness.calls[3][1].message, 'Redirect unavailable');
});

test('A post-delete List failure never queues the completed Delete for replay', async () => {
    const harness = await loadDeleteHook(async () => {}, [], callback => callback(), {
        refreshError: new Error('AADSTS7006105: Downstream token acquisition failed'),
    });
    await harness.render().performDelete(
        'passkey-1', 'Test passkey', '/api/v1.0/me/methods/fido/passkey-1');
    assert.equal(harness.calls[0][0], 'delete');
    assert.equal(harness.calls[1][1].type, 'deleted');
    assert.equal(harness.calls[2][0], 'refresh');
    assert.equal(harness.calls.length, 3);
    assert.equal(harness.pendingOperation, undefined);
});

test('Successful Delete waits two seconds before refreshing List', async () => {
    let finishDelay;
    const harness = await loadDeleteHook(async () => {}, [], (callback, delay) => {
        assert.equal(delay, 2000);
        finishDelay = callback;
    });
    const pending = harness.render().performDelete(
        'passkey-1', 'Test passkey', '/api/v1.0/me/methods/fido/passkey-1');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.calls.length, 2);
    assert.equal(harness.calls[1][1].type, 'deleted');
    assert.equal(typeof finishDelay, 'function');
    finishDelay();
    await pending;
    assert.equal(harness.calls[2][0], 'refresh');
});
