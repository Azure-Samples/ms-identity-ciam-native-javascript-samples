import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const require = createRequire(import.meta.url);
const react = require('react');
const bootstrap = require('react-bootstrap');
const { InteractionRequiredAuthError } = require('@azure/msal-browser');
const account = { homeAccountId: 'test-account', username: 'test-user' };
const instance = { getActiveAccount: () => account };
const config = { authority: 'https://proxy.example/selfservice-api', apiQueryParams: { dc: 'test-dc' } };
const password = { id: 'password-id', lastUpdatedDateTime: '2026-01-02T03:04:05Z',
    updateHref: '/tenant/api/v1.0/me/methods/password/password-id?dc=old' };
const passkey = { id: 'passkey-id', name: 'Security key' };
const values = { currentPassword: ' current-test-password ', newPassword: ' new-test-password ',
    confirmPassword: ' new-test-password ' };
const passthrough = ({ children }) => children;

async function loadSource(filename, mocks = {}, globals = {}) {
    const url = new URL(filename, import.meta.url);
    const { code } = await transformWithEsbuild(await readFile(url, 'utf8'), fileURLToPath(url), {
        loader: 'jsx', jsx: 'automatic', format: 'cjs',
    });
    const module = { exports: {} };
    runInNewContext(code, {
        module, exports: module.exports,
        URL, URLSearchParams, AbortController, DOMException, setTimeout, clearTimeout, atob, btoa,
        console: { log() {}, warn() {}, error() {} },
        require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
        ...globals,
    });
    return module.exports;
}

async function loadApi(fetch, globals = {}, tokenProvider = async () => 'test-token', apiConfig = config) {
    const token = { getSelfServiceAccessToken: tokenProvider };
    const transport = await loadSource('../src/services/selfServiceApiClient.js', {
        '../authConfig': { selfServiceApiConfig: apiConfig },
        '../utils/selfServiceToken': token,
    }, { fetch, ...globals });
    const passkeys = await loadSource('../src/services/passkeyService.js', {
        './selfServiceApiClient': transport,
        '../utils/selfServiceToken': token,
        '../utils/graphServiceUtils': graphServiceUtils,
    }, globals);
    const password = await loadSource('../src/services/passwordService.js', {
        './selfServiceApiClient': transport,
        '../utils/selfServiceToken': token,
    }, globals);
    const credentials = await loadSource('../src/services/credentialsService.js', {
        './selfServiceApiClient': transport,
        './passkeyService': passkeys,
        './passwordService': password,
    });
    return { ...credentials, ...passkeys, ...password };
}

const graphServiceUtils = await loadSource('../src/utils/graphServiceUtils.js');
const passkeyUtils = await loadSource('../src/utils/passkeyUtils.js');
const authenticationUtils = await loadSource('../src/utils/authenticationUtils.js');

function pending(status = 'running', continuationToken = 'ct-1', pollInterval = '2') {
    return { id: password.id, type: 'password', status, continuationToken, pollInterval,
        _links: { pollUpdate: { href: `${password.updateHref.split('?')[0]}/pollUpdate?dc=old` } } };
}

test('one methods request supplies password and passkeys using the existing MSAL account', async () => {
    let requests = 0;
    let tokens = 0;
    const api = await loadApi(async (url, options) => {
        requests += 1;
        assert.equal(new URL(url).pathname, '/selfservice-api/api/v1.0/me/methods');
        assert.equal(new URL(url).searchParams.get('dc'), 'test-dc');
        assert.equal(options.method, 'GET');
        assert.equal(options.cache, 'no-store');
        return Response.json({ _embedded: { methods: [
            { ...passkey, type: 'fido', displayName: passkey.name, _links: { delete: { href: '/delete' } } },
            { id: password.id, type: 'password', lastUpdatedDateTime: password.lastUpdatedDateTime,
                _links: { update: { href: password.updateHref } } },
        ] } });
    }, {}, async (msal, signedInAccount) => {
        assert.equal(msal, instance);
        assert.equal(signedInAccount, account);
        tokens += 1;
        return 'test-token';
    });
    const result = await api.fetchSelfServiceCredentials(instance, account);
    assert.equal(requests, 1);
    assert.equal(tokens, 1);
    assert.equal(result.passkeys[0].name, passkey.name);
    assert.equal(result.passkeys[0].canDelete, true);
    assert.equal(result.passkeys[0].deleteHref, '/delete');
    assert.equal(result.password.updateHref, password.updateHref);
    assert.equal(result.password.lastUpdatedDateTime, password.lastUpdatedDateTime);
});

test('credential discovery preserves the configured scope and MFA claims in the silent token request', async () => {
    const apiConfig = {
        ...config,
        scope: 'api://test-resource/Me.UserAuthenticationMethod.ReadWrite',
        exchangeAuthority: 'https://login.example/test-tenant',
        exchangeRedirectUri: 'http://localhost:3000/',
        claims: JSON.stringify({ access_token: {
            acrs: { essential: true, values: ['urn:user:registersecurityinfo'] },
            amr: { essential: true, values: ['ngcmfa'] },
        } }),
    };
    const { getSelfServiceAccessToken } = await loadSource('../src/utils/selfServiceToken.js', {
        '../authConfig': { selfServiceApiConfig: apiConfig },
    });
    const tokenRequests = [];
    const msal = {
        acquireTokenSilent: async (request) => {
            tokenRequests.push(request);
            return { accessToken: 'test-token', fromCache: true };
        },
        acquireTokenRedirect: () => assert.fail('A successful silent request must not force verification'),
    };
    const api = await loadApi(async () => Response.json({ _embedded: { methods: [] } }),
        {}, getSelfServiceAccessToken, apiConfig);
    await api.fetchSelfServiceCredentials(msal, account);
    assert.equal(tokenRequests.length, 1);
    const [request] = tokenRequests;
    assert.equal(request.account, account);
    assert.equal(request.authority, apiConfig.exchangeAuthority);
    assert.equal(request.redirectUri, apiConfig.exchangeRedirectUri);
    assert.equal(request.scopes.length, 1);
    assert.equal(request.scopes[0], apiConfig.scope);
    assert.equal(request.claims, apiConfig.claims);
    assert.equal(request.forceRefresh, false);
});

test('missing password methods return null; malformed collections remain errors', async () => {
    const withoutPassword = await loadApi(async () => Response.json({ _embedded: { methods: [] } }));
    assert.equal((await withoutPassword.fetchSelfServiceCredentials(instance, account)).password, null);
    const invalid = await loadApi(async () => Response.json({}));
    await assert.rejects(invalid.fetchSelfServiceCredentials(instance, account), /methods response/);
});

test('the existing passkey list API and its network defaults remain available', async () => {
    const api = await loadApi(async (url, options) => {
        assert.equal(options.redirect, undefined);
        assert.equal(options.cache, undefined);
        return Response.json({ _embedded: { methods: [{ id: passkey.id, type: 'fido' }] } });
    });
    assert.equal((await api.fetchSelfServicePasskeys(instance, account))[0].id, passkey.id);
});

test('the passkey service preserves enrollment, authenticator options, and activation', async () => {
    const requests = [];
    let publicKey;
    const api = await loadApi(async (url, options) => {
        requests.push({ path: new URL(url).pathname, method: options.method,
            body: options.body ? JSON.parse(options.body) : undefined });
        if (requests.length === 1) {
            return Response.json({
                type: 'fido', state: 'interactionRequired', continuationToken: 'enrollment-token',
                _links: { activate: { href: '/tenant/api/v1.0/me/methods/fido/new-key/activate' } },
                publicKey: {
                    challenge: 'aGVsbG8', user: { id: 'dXNlcg' }, rp: { id: 'test.example' },
                    authenticatorSelection: { authenticatorAttachment: 'cross-platform', userVerification: 'required' },
                    excludeCredentials: [{ id: 'YWJjZA2', type: 'public-key' }],
                    extensions: { enforceCredentialProtectionPolicy: true },
                },
            });
        }
        return Response.json({ id: 'new-key', type: 'fido' });
    }, { navigator: { credentials: { create: async (options) => {
        publicKey = options.publicKey;
        return { id: 'browser-key', response: {
            attestationObject: new Uint8Array([1, 2, 3]).buffer,
            clientDataJSON: new Uint8Array([4, 5, 6]).buffer,
        } };
    } } } });
    assert.equal((await api.registerSelfServicePasskey(instance, account, ' Test key ')).id, 'new-key');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].path, '/selfservice-api/api/v1.0/me/methods/fido');
    assert.equal(publicKey.authenticatorSelection.authenticatorAttachment, undefined);
    assert.equal(publicKey.authenticatorSelection.userVerification, 'required');
    assert.deepEqual([...new Uint8Array(publicKey.challenge)], [104, 101, 108, 108, 111]);
    assert.deepEqual([...new Uint8Array(publicKey.excludeCredentials[0].id)], [97, 98, 99, 100]);
    assert.equal(publicKey.extensions.enforceCredentialProtectionPolicy, false);
    assert.equal(requests[1].method, 'POST');
    assert.equal(requests[1].path, '/selfservice-api/api/v1.0/me/methods/fido/new-key/activate');
    assert.deepEqual(requests[1].body, {
        continuationToken: 'enrollment-token', displayName: 'Test key',
        publicKeyCredential: { id: 'browser-key', attestationObject: 'AQID', clientDataJSON: 'BAUG' },
    });
});

test('the passkey service deletes only through the supplied delegated action', async () => {
    let requests = 0;
    const api = await loadApi(async (url, options) => {
        requests += 1;
        assert.equal(new URL(url).pathname, '/selfservice-api/api/v1.0/me/methods/fido/key-id');
        assert.equal(options.method, 'DELETE');
        assert.equal(options.body, undefined);
        return new Response(null, { status: 204 });
    });
    await assert.rejects(api.deleteSelfServicePasskey(instance, account, undefined), /cannot be deleted/);
    assert.equal(requests, 0);
    await api.deleteSelfServicePasskey(instance, account, '/tenant/api/v1.0/me/methods/fido/key-id');
    assert.equal(requests, 1);
});

test('password update sends current/new once and polls only with refreshed continuation tokens', async () => {
    const requests = [];
    const delays = [];
    const replies = [
        Response.json(pending('notStarted'), { status: 202 }),
        Response.json(pending('running', 'ct-2', '3')),
        Response.json({ id: password.id, type: 'password', status: 'succeeded' }),
    ];
    const api = await loadApi(async (url, options) => {
        assert.equal(new URL(url).searchParams.get('dc'), 'test-dc');
        assert.equal(options.redirect, 'error');
        requests.push({ method: options.method, body: JSON.parse(options.body) });
        return replies.shift();
    }, { setTimeout: (callback, delay) => { delays.push(delay); queueMicrotask(callback); return 1; },
        clearTimeout() {} });
    await api.updateSelfServicePassword(instance, account, password, values);
    assert.deepEqual(requests, [
        { method: 'PUT', body: { currentPassword: values.currentPassword, newPassword: values.newPassword } },
        { method: 'POST', body: { continuationToken: 'ct-1' } },
        { method: 'POST', body: { continuationToken: 'ct-2' } },
    ]);
    assert.deepEqual(delays, [2000, 3000]);
});

test('unavailable updates and wrong-method links fail before token acquisition', async () => {
    const api = await loadApi(() => assert.fail('Unexpected request'), {}, () => assert.fail('Unexpected token request'));
    await assert.rejects(api.updateSelfServicePassword(instance, account, { id: password.id }, values), /not available/);
    await assert.rejects(api.updateSelfServicePassword(instance, account, {
        ...password, updateHref: '/tenant/api/v1.0/me/methods/fido/passkey-id',
    }, values), /password method link/);
});

test('malformed pending updates never report success or poll another method', async () => {
    for (const result of [{ id: password.id, type: 'password', status: 'running' },
        { ...pending(), _links: { pollUpdate: { href: '/tenant/api/v1.0/me/methods/password/other-id/pollUpdate' } } }]) {
        let requests = 0;
        const api = await loadApi(async () => { requests += 1; return Response.json(result, { status: 202 }); });
        await assert.rejects(api.updateSelfServicePassword(instance, account, password, values), /invalid|Invalid/);
        assert.equal(requests, 1);
    }
});

test('closing a pending update stops polling without resending passwords', async () => {
    const controller = new AbortController();
    let requests = 0;
    const api = await loadApi(async () => { requests += 1; return Response.json(pending(), { status: 202 }); });
    await assert.rejects(api.updateSelfServicePassword(instance, account, password, values, {
        signal: controller.signal, onPending: () => controller.abort(),
    }), { name: 'AbortError' });
    assert.equal(requests, 1);
});

test('synchronous completion and server policy errors do not retry password writes', async () => {
    let requests = 0;
    const success = await loadApi(async () => { requests += 1; return new Response(null, { status: 204 }); });
    await success.updateSelfServicePassword(instance, account, password, values);
    assert.equal(requests, 1);
    const rejected = await loadApi(async () => Response.json({
        error: { message: 'The new password does not meet the policy.' },
    }, { status: 400 }));
    await assert.rejects(rejected.updateSelfServicePassword(instance, account, password, values), /does not meet the policy/);
});

test('password writes cannot follow an HTTP redirect', async () => {
    const paths = [];
    const server = createServer((request, response) => {
        paths.push(request.url); request.resume();
        response.writeHead(307, { Location: '/redirected' }); response.end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const api = await loadApi(fetch, {}, undefined, {
            ...config, authority: `http://127.0.0.1:${server.address().port}/selfservice-api`,
        });
        await assert.rejects(api.updateSelfServicePassword(instance, account, password, values));
        assert.equal(paths.length, 1);
    } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    }
});

async function fetcherFixture(read) {
    const state = [{ accountId: null, passkeys: [], password: null }, true, null];
    const refs = [];
    const calls = { toasts: [], cachedOperation: null, reauthentications: 0, redirects: [], delays: [] };
    const credentialUtils = await loadSource('../src/utils/credentialUtils.js', {}, {
        setTimeout: (callback, delay) => { calls.delays.push(delay); queueMicrotask(callback); return 1; },
    });
    let index = 0;
    let cleanup;
    const { useCredentialsFetcher } = await loadSource('../src/hooks/credentials/useCredentialsFetcher.js', {
        react: {
            useState: () => { const i = index++; return [state[i], (value) => { state[i] = value; }]; },
            useRef: (value) => { const ref = { current: value }; refs.push(ref); return ref; },
            useCallback: (callback) => callback,
            useEffect: (effect) => { cleanup = effect(); },
        },
        '../../services/credentialsService': { fetchSelfServiceCredentials: read },
        '../../utils/selfServiceToken': {
            redirectForSelfServiceAccess: async (...args) => { calls.redirects.push(args); },
        },
        '../../utils/credentialUtils': credentialUtils,
        '../../utils/authenticationUtils': authenticationUtils,
        '../common/useAuthentication': { useAuthentication: () => ({
            getCachedOperation: () => calls.cachedOperation,
            cacheOperation: (operation) => { calls.cachedOperation = operation; },
            handleReAuthentication: async () => { calls.reauthentications += 1; },
        }) },
    });
    const hook = useCredentialsFetcher({ instance, account, onShowToast: (toast) => calls.toasts.push(toast) });
    return { state, refs, cleanup, hook, calls };
}

test('the shared fetch hook publishes both method types from one request', async () => {
    let requests = 0;
    const result = { passkeys: [passkey], password };
    const fixture = await fetcherFixture(async () => { requests += 1; return result; });
    assert.equal((await fixture.hook.fetchCredentials()).passkeys[0], passkey);
    assert.equal(requests, 1);
    assert.equal(fixture.state[0].password, password);
    assert.equal(fixture.state[1], false);
});

test('credential loading preserves the existing interaction and reauthentication routes', async (t) => {
    const cases = [
        ['interaction required', new InteractionRequiredAuthError('interaction_required'), false],
        ['consent required', new InteractionRequiredAuthError('consent_required'), false],
        ['expired API token', Object.assign(new Error('Expired token'), { status: 401 }), true],
        ['reauthentication required', new Error('AADSTS7006105: Reauthentication required.'), true],
    ];
    for (const [name, error, fullSignIn] of cases) {
        await t.test(name, async () => {
            const fixture = await fetcherFixture(async () => { throw error; });
            assert.equal(await fixture.hook.fetchCredentials(), null);
            assert.equal(fixture.state[1], false);
            assert.match(fixture.state[2], /Additional verification is required/);
            assert.equal(fixture.calls.cachedOperation.action, 'list');
            assert.equal(fixture.calls.reauthentications, fullSignIn ? 1 : 0);
            assert.equal(fixture.calls.redirects.length, 0);
            if (!fullSignIn) {
                const [prompt] = fixture.calls.toasts;
                assert.equal(fixture.calls.toasts.length, 1);
                assert.equal(prompt.type, 'sessionExpiredWithAction');
                await prompt.action.onClick();
                assert.equal(fixture.calls.redirects.length, 1);
                assert.equal(fixture.calls.redirects[0][0], instance);
                assert.equal(fixture.calls.redirects[0][1], account);
            }
        });
    }
});

test('failed initial credential loading terminates the shared loading state', async () => {
    const fixture = await fetcherFixture(async () => { throw new Error('Service unavailable'); });
    assert.equal(await fixture.hook.fetchCredentials(), null);
    assert.equal(fixture.state[1], false);
    assert.match(fixture.state[2], /Service unavailable/);
});

test('older requests and departed accounts cannot overwrite newer credential data', async () => {
    const requests = [];
    const fixture = await fetcherFixture(() => new Promise((resolve) => requests.push(resolve)));
    const first = fixture.hook.fetchCredentials();
    const second = fixture.hook.fetchCredentials();
    const latest = { passkeys: [], password: { ...password, lastUpdatedDateTime: 'new-date' } };
    requests[1](latest); await second;
    requests[0]({ passkeys: [], password }); await first;
    assert.equal(fixture.state[0].password, latest.password);
    const leaving = fixture.hook.fetchCredentials();
    fixture.cleanup();
    requests[2]({ passkeys: [], password }); await leaving;
    assert.equal(fixture.state[0].password, latest.password);
});

test('passkey mutations retain their propagation retries without repeating the mutation', async (t) => {
    for (const action of ['add', 'delete']) {
        await t.test(action, async () => {
            const key = { ...passkey, deleteHref: '/tenant/api/v1.0/me/methods/fido/passkey-id' };
            const finalPasskeys = action === 'add' ? [key, { ...key, id: 'new-key' }] : [];
            let reads = 0;
            const fixture = await fetcherFixture(async () => ({
                passkeys: ++reads === 1 ? [key] : finalPasskeys, password,
            }));
            const mutations = [];
            const propagationDelays = [];
            const operations = await loadSource(
                action === 'add' ? '../src/hooks/passkeys/usePasskeyAddOperation.js'
                    : '../src/hooks/passkeys/usePasskeyDeleteOperation.js', {
                    react: { useState: (initial) => [initial, () => {}] },
                    '../../services/passkeyService': {
                        registerSelfServicePasskey: async (...args) => { mutations.push(args); },
                        deleteSelfServicePasskey: async (...args) => { mutations.push(args); },
                    },
                    '../../utils/passkeyUtils': passkeyUtils,
                    '../../utils/authenticationUtils': authenticationUtils,
                    '../common/useAuthentication': { useAuthentication: () => ({}) },
                }, {
                    setTimeout: (callback, delay) => { propagationDelays.push(delay); queueMicrotask(callback); return 1; },
                });
            const useOperation = action === 'add' ? operations.usePasskeyAddOperation : operations.usePasskeyDeleteOperation;
            const operation = useOperation({
                instance, account, currentPasskeys: [key], fetchCredentials: fixture.hook.fetchCredentials,
                onShowToast: (toast) => fixture.calls.toasts.push(toast),
            });
            if (action === 'add') await operation.performAddPasskey('Test key');
            else await operation.performDelete(key.id, key.name, key.deleteHref);
            assert.equal(mutations.length, 1);
            assert.equal(mutations[0][0], instance);
            assert.equal(mutations[0][1], account);
            assert.equal(mutations[0][2], action === 'add' ? 'Test key' : key.deleteHref);
            assert.equal(reads, 2);
            assert.deepEqual(propagationDelays, [2000]);
            assert.deepEqual(fixture.calls.delays, [500]);
            assert.equal(fixture.state[0].password, password);
            assert.equal(fixture.state[0].passkeys, finalPasskeys);
            assert.equal(fixture.state[1], false);
            assert.equal(fixture.calls.toasts.length, action === 'add' ? 2 : 1);
        });
    }
});

function findElement(node, predicate) {
    if (Array.isArray(node)) return node.map((child) => findElement(child, predicate)).find(Boolean);
    if (!node || typeof node !== 'object') return null;
    return predicate(node) ? node : findElement(node.props?.children, predicate);
}

async function uiFixture(data = {}, { showModal = false, isAdding = false, operation = null, runEffects = false } = {}) {
    const calls = { verifications: [], toasts: [], cleared: 0, modalStates: [] };
    const effects = [];
    const hooks = { ...react, useState: () => [showModal, (value) => calls.modalStates.push(value)],
        useEffect: (effect) => effects.push(effect) };
    const authentication = {
        useAuthentication: () => ({
            getCachedOperation: () => operation,
            clearCachedOperation: () => { calls.cleared += 1; },
            requestVerification: async (...args) => calls.verifications.push(args),
        }),
    };
    const passwordOperation = await loadSource('../src/hooks/password/usePasswordChangeOperation.js', {
        react: hooks,
        '../../services/passwordService': { updateSelfServicePassword: (...args) => {
            calls.passwordUpdate = args;
        } },
        '../../utils/authenticationUtils': authenticationUtils,
        '../common/useAuthentication': authentication,
    });
    const row = await loadSource('../src/components/password/PasswordCredential.jsx', {
        '../../utils/graphServiceUtils': { formatDetailedDate: (date) => date },
    });
    const list = await loadSource('../src/components/credentials/components/CredentialsList.jsx', {
        '../../password/PasswordCredential': row,
        '../../passkeys/components/PasskeyItem': { __esModule: true, default: ({ passkey }) => (
            createElement(bootstrap.ListGroup.Item, null, passkey.name)
        ) },
    });
    const header = await loadSource('../src/components/passkeys/components/PasskeysHeader.jsx');
    const Dialog = () => null;
    const { default: Section } = await loadSource('../src/components/credentials/CredentialsSection.jsx', {
        react: hooks,
        '@azure/msal-react': { useMsal: () => ({ instance, accounts: [account] }) },
        '../passkeys/components/PasskeysHeader': header, './components/CredentialsList': list,
        '../passkeys/components/DeleteModal': { __esModule: true, default: () => null },
        '../passkeys/components/AddPasskeyModal': { __esModule: true, default: () => null },
        '../password/ChangePasswordModal': { __esModule: true, default: Dialog },
        '../../utils/passkeyUtils': passkeyUtils,
        '../../hooks/common/useAuthentication': authentication,
        '../../hooks/password/usePasswordChangeOperation': passwordOperation,
        '../../hooks/credentials/useCredentialsFetcher': {
            useCredentialsFetcher: () => ({ passkeys: [], password: null, isLoading: false, error: null,
                fetchCredentials: async () => ({ passkeys: [], password: null }), ...data }),
        },
        '../../hooks/passkeys': {
            usePasskeyAddOperation: () => ({ isAdding, nameModalProps: {} }),
            usePasskeyDeleteOperation: (options) => { calls.deletion = options; return { modalProps: {} }; },
        },
    });
    const tree = Section({ onShowToast: (toast) => calls.toasts.push(toast) });
    if (runEffects) {
        effects.forEach((effect) => effect());
        await new Promise((resolve) => setImmediate(resolve));
    }
    return { calls, tree, html: renderToStaticMarkup(tree),
        modal: findElement(tree, (node) => node.type === Dialog)?.props,
        change: findElement(tree, (node) => node.type === list.default).props.onChangePassword };
}

test('Credentials is one flat list; password-only accounts have no empty passkey subgroup', async () => {
    const both = await uiFixture({ password, passkeys: [passkey] });
    assert.equal((both.html.match(/class="list-group(?:\s|")/g) || []).length, 1);
    assert.equal((both.html.match(/\blist-group-item(?:\s|")/g) || []).length, 2);
    assert.ok(both.html.indexOf('<strong>Password</strong>') < both.html.indexOf(passkey.name));
    assert.doesNotMatch(both.html, /<h[1-6][^>]*>Passkeys/);
    const onlyPassword = await uiFixture({ password });
    assert.doesNotMatch(onlyPassword.html, /No credentials|No passkeys/);
    assert.doesNotMatch((await uiFixture({ passkeys: [passkey] })).html, /Change password/);
});

test('password change is offered only on the password row, not beside Add Passkey', async () => {
    const fixture = await uiFixture({ password, passkeys: [passkey] });
    assert.ok(!findElement(fixture.tree, (node) => (
        node.type === bootstrap.Button && node.props.children === 'Change password'
    )));
    assert.match(fixture.html, /aria-label="Change password"/);
    assert.match(fixture.html, /Add Passkey/);
    fixture.change();
    assert.deepEqual(fixture.calls.modalStates, [true]);
});

test('failed loading shows an error rather than an indefinite password spinner', async () => {
    const failed = await uiFixture({ error: 'Service unavailable', isLoading: false });
    assert.match(failed.html, /Service unavailable/);
    assert.doesNotMatch(failed.html, /Loading credentials/);
});

test('the existing add action still respects loading and the passkey limit', async () => {
    const { default: Header } = await loadSource('../src/components/passkeys/components/PasskeysHeader.jsx');
    const html = (props) => renderToStaticMarkup(createElement(Header, props));
    assert.doesNotMatch(html({ count: 1, maxCount: 10 }), /disabled/);
    assert.match(html({ count: 10, maxCount: 10 }), /disabled/);
    assert.match(html({ count: 1, maxCount: 10, isLoading: true }), /disabled/);
});

test('password verification reuses upstream consent and delegated passkey deletion wiring', async () => {
    const fixture = await uiFixture({ password }, { showModal: true });
    assert.equal(await fixture.modal.onAuthenticationError(
        new InteractionRequiredAuthError('interaction_required', 'Verification required.')), true);
    const [operation, signedInAccount, fullSignIn] = fixture.calls.verifications[0];
    assert.deepEqual(Object.keys(operation), ['action']);
    assert.equal(operation.action, 'changePassword');
    assert.equal(signedInAccount, account);
    assert.equal(fullSignIn, false);
    assert.equal(fixture.calls.deletion.instance, instance);
    assert.equal(fixture.calls.deletion.account, account);
});

test('the password operation submits through its own service and refreshes the shared collection', async () => {
    let refreshes = 0;
    const fixture = await uiFixture({ password, fetchCredentials: async () => {
        refreshes += 1;
        return { passkeys: [], password };
    } }, { showModal: true });
    const submitted = { currentPassword: values.currentPassword, newPassword: values.newPassword };
    const options = { signal: new AbortController().signal };
    await fixture.modal.onSubmitPassword(submitted, options);
    assert.equal(fixture.calls.passwordUpdate[0], instance);
    assert.equal(fixture.calls.passwordUpdate[1], account);
    assert.equal(fixture.calls.passwordUpdate[2], password);
    assert.equal(fixture.calls.passwordUpdate[3], submitted);
    assert.equal(fixture.calls.passwordUpdate[4], options);
    fixture.modal.onSuccess();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(refreshes, 1);
    assert.deepEqual(fixture.calls.modalStates, [false]);
    assert.equal(fixture.calls.toasts[0].variant, 'success');
});

test('only authentication failures invoke the existing re-sign-in prompt', async () => {
    const fixture = await uiFixture({ password }, { showModal: true });
    assert.equal(await fixture.modal.onAuthenticationError(new Error('Password policy rejection.')), false);
    assert.equal(fixture.calls.verifications.length, 0);
    assert.equal(await fixture.modal.onAuthenticationError(new Error('AADSTS7006105: Reauthentication required.')), true);
    assert.equal(fixture.calls.verifications[0][2], true);
    assert.equal(await fixture.modal.onAuthenticationError(Object.assign(new Error('Expired token'), { status: 401 })), true);
    assert.equal(fixture.calls.verifications[1][2], true);
});

test('the add action remains disabled during upstream passkey registration', async () => {
    const fixture = await uiFixture({ password }, { isAdding: true });
    const button = findElement(fixture.tree, (node) => node.props?.onAddClick !== undefined ||
        node.props?.maxCount !== undefined);
    assert.equal(button.props.isLoading, true);
});

test('cached password changes wait for fresh method details before reopening', async () => {
    const options = { operation: { action: 'changePassword' }, runEffects: true };
    const loading = await uiFixture({ isLoading: true }, options);
    assert.equal(loading.calls.cleared, 0);
    assert.equal(loading.calls.modalStates.length, 0);
    const ready = await uiFixture({ password }, options);
    assert.equal(ready.calls.cleared, 1);
    assert.deepEqual(ready.calls.modalStates, [true]);
    const unavailable = await uiFixture({}, options);
    assert.equal(unavailable.calls.cleared, 1);
    assert.equal(unavailable.calls.modalStates.length, 0);
});

const TestModal = passthrough;
TestModal.Header = passthrough; TestModal.Body = passthrough; TestModal.Footer = passthrough;
TestModal.Title = ({ children }) => createElement('h2', null, children);
const loadModal = (hooks = react) => loadSource('../src/components/password/ChangePasswordModal.jsx', {
    react: hooks, 'react-bootstrap': { ...bootstrap, Modal: TestModal },
});

test('password form validates confirmation and uses masked password-manager-compatible fields', async () => {
    const { default: Dialog, validatePasswordChange } = await loadModal();
    assert.equal(Object.keys(validatePasswordChange(values)).length, 0);
    assert.equal(Object.keys(validatePasswordChange({ currentPassword: '', newPassword: '', confirmPassword: '' })).length, 3);
    assert.match(validatePasswordChange({ ...values, confirmPassword: 'different' }).confirmPassword, /do not match/);
    const html = renderToStaticMarkup(createElement(Dialog, {}));
    assert.equal((html.match(/type="password"/g) || []).length, 3);
    assert.match(html, /Current password/);
    assert.match(html, /autoComplete="current-password"/i);
    assert.equal((html.match(/autoComplete="new-password"/gi) || []).length, 2);
});

test('submission rejects mismatched confirmation and clears accepted password values', async () => {
    for (const input of [values, { ...values, confirmPassword: 'different' }]) {
        const valid = input.confirmPassword === input.newPassword;
        const states = [input, {}, null, 'idle'];
        const updates = [];
        let index = 0;
        let cleanup;
        let succeeded = false;
        let submitted = false;
        const { default: Dialog } = await loadModal({ ...react,
            useState: () => { const i = index++; return [states[i], (value) => updates.push({ i, value })]; },
            useRef: () => ({ current: null }), useEffect: (effect) => { cleanup = effect(); },
        });
        const tree = Dialog({
            onSubmitPassword: async (body, options) => {
                submitted = true;
                assert.equal(valid, true);
                assert.deepEqual(Object.keys(body), ['currentPassword', 'newPassword']);
                assert.equal(body.currentPassword, values.currentPassword);
                options.onPending();
                assert.equal(succeeded, false);
            },
            onSuccess: () => { succeeded = true; },
        });
        try {
            await findElement(tree, (node) => node.type === bootstrap.Form).props.onSubmit({ preventDefault() {} });
            assert.equal(submitted, valid);
            assert.equal(succeeded, valid);
            if (valid) {
                assert.ok(updates.some(({ i, value }) => i === 0 &&
                    !value.currentPassword && !value.newPassword && !value.confirmPassword));
            } else {
                assert.ok(updates.some(({ i, value }) => i === 1 && value.confirmPassword));
            }
        } finally {
            cleanup();
        }
    }
});

test('unmounting the password dialog aborts pending work and cannot report success', async () => {
    const states = [values, {}, null, 'idle'];
    let index = 0;
    let cleanup;
    let signal;
    let complete;
    let succeeded = false;
    const { default: Dialog } = await loadModal({ ...react,
        useState: () => { const i = index++; return [states[i], (value) => { states[i] = value; }]; },
        useRef: () => ({ current: null }),
        useEffect: (effect) => { cleanup = effect(); },
    });
    const tree = Dialog({
        onSubmitPassword: (body, options) => {
            signal = options.signal;
            options.onPending();
            return new Promise((resolve) => { complete = resolve; });
        },
        onSuccess: () => { succeeded = true; },
    });
    const submission = findElement(tree, (node) => node.type === bootstrap.Form).props.onSubmit({ preventDefault() {} });
    assert.equal(states[3], 'polling');
    assert.equal(states[0].currentPassword, '');
    assert.equal(states[0].newPassword, '');
    assert.equal(states[0].confirmPassword, '');
    cleanup();
    assert.equal(signal.aborted, true);
    complete();
    await submission;
    assert.equal(succeeded, false);
});
