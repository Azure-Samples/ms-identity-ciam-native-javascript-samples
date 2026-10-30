import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { transformWithEsbuild } from 'vite';

const account = {
    homeAccountId: 'test-account',
    idTokenClaims: { oid: 'test-user', name: 'Test User', email: 'test@example.com' },
};
const instance = {};

function createStorage() {
    const entries = new Map();
    return {
        getItem: key => entries.get(key) ?? null,
        setItem: (key, value) => entries.set(key, String(value)),
        removeItem: key => entries.delete(key),
    };
}

function tokenResult(iat) {
    const payload = Buffer.from(JSON.stringify({
        iat, oid: 'token-user', name: 'Token User', email: 'token@example.com',
    })).toString('base64url');
    return { account, accessToken: `test.${payload}.signature` };
}

async function load(path, dependencies = {}, globals = {}) {
    const url = new URL(path, import.meta.url);
    let source = await readFile(url, 'utf8');
    if (path.endsWith('.jsx')) {
        ({ code: source } = await transformWithEsbuild(source, url.pathname, {
            loader: 'jsx', jsx: 'transform', jsxFactory: 'createElement',
        }));
    }
    const context = createContext({
        URL, console, atob, decodeURIComponent, ...globals,
    });
    const module = new SourceTextModule(source, {
        context,
        initializeImportMeta: meta => { meta.env = {}; },
    });
    await module.link(specifier => {
        const values = dependencies[specifier];
        assert.ok(values, `Unexpected dependency: ${specifier}`);
        return new SyntheticModule(Object.keys(values), function () {
            for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }, { context });
    });
    await module.evaluate();
    return module.namespace;
}

const loadTokenUtils = () => load('../src/utils/tokenUtils.js');

async function renderSecurityPage({
    accessToken = tokenResult(1000).accessToken,
    afterSignIn = false,
    tokenError,
    selfServiceError,
} = {}) {
    const utils = await loadTokenUtils();
    const effects = [];
    const state = [];
    const calls = [];
    let cursor = 0;
    const createElement = (type, props, ...children) => ({ type, props, children });
    const pageInstance = {
        getActiveAccount: () => account,
        acquireTokenSilent: async request => {
            calls.push(['token', request]);
            if (tokenError) throw tokenError;
            return { accessToken };
        },
    };
    const page = await load('../src/components/SecurityPage.jsx', {
        react: {
            useState(initial) {
                const index = cursor++;
                if (!(index in state)) state[index] = initial;
                return [state[index], value => { state[index] = value; }];
            },
            useEffect: effect => effects.push(effect),
        },
        'react-bootstrap': { Container: 'Container', Alert: 'Alert', Spinner: 'Spinner' },
        'react-icons/fa': { FaBell: 'FaBell' },
        '@azure/msal-react': {
            useMsal: () => ({ instance: pageInstance, accounts: [account] }),
        },
        '../authConfig': { loginRequest: {} },
        '../utils/tokenUtils': {
            getAccessToken: utils.getAccessToken,
        },
        '../utils/selfServiceToken': {
            acquireSelfServiceTokenAfterSignIn: async () => {
                calls.push(['self-service']);
                if (selfServiceError) throw selfServiceError;
            },
            isSelfServiceTokenAcquisitionAfterSignInPending: () => afterSignIn,
        },
        './common/UIComponents': { UserProfileHeader: 'Profile', SecurityAlert: 'SecurityAlert' },
        './common/ToastNotifications': { default: 'Toasts' },
        './passkeys/PasskeysSection': { default: 'PasskeysSection' },
    }, { createElement });
    page.SecurityPage();
    effects.forEach(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
    cursor = 0;
    const rendered = page.SecurityPage();
    assert.equal(rendered.type, 'Container');
    return {
        calls,
        rendered,
        passkeys: rendered.children.find(child => child?.type === 'PasskeysSection'),
        profile: rendered.children.find(child => child?.type === 'Profile'),
    };
}

test('Reload initializes passkeys and the latest profile without app-token dependencies', async () => {
    const initial = await renderSecurityPage();
    assert.ok(initial.passkeys);
    assert.deepEqual(initial.calls.map(call => call[0]), ['token', 'self-service']);
    const cached = await renderSecurityPage();
    assert.ok(cached.passkeys);
    const renewed = await renderSecurityPage({
        accessToken: tokenResult(1500).accessToken,
    });
    assert.ok(renewed.passkeys);
    assert.equal(renewed.calls[0][1].forceRefresh, false);
    assert.equal(renewed.profile.props.name, 'Token User');
    assert.equal(renewed.profile.props.email, 'token@example.com');
});

test('Re-sign-in forces acquisition and preserves the subsequent Self Service token exchange', async () => {
    const result = await renderSecurityPage({
        afterSignIn: true, accessToken: tokenResult(2000).accessToken,
    });
    assert.ok(result.passkeys);
    assert.equal(result.calls[0][1].forceRefresh, true);
    assert.deepEqual(result.calls.map(call => call[0]), ['token', 'self-service']);
});

test('An unreadable latest token still uses the account profile', async () => {
    const result = await renderSecurityPage({ accessToken: 'opaque-access-token' });
    assert.ok(result.passkeys);
    assert.equal(result.profile.props.name, 'Test User');
});

test('Access-token acquisition failure is surfaced and does not run the Self Service exchange', async () => {
    const result = await renderSecurityPage({ tokenError: new Error('Test acquisition failed') });
    assert.ok(result.passkeys);
    assert.deepEqual(result.calls.map(call => call[0]), ['token']);
    const alert = result.rendered.children.find(child => child?.type === 'Alert');
    assert.match(alert.children[0], /Failed to acquire access token/);
});

test('Self Service token acquisition failure remains visible and blocks passkey operations', async () => {
    const result = await renderSecurityPage({ selfServiceError: new Error('Test exchange failed') });
    assert.equal(result.passkeys, undefined);
    const alert = result.rendered.children.find(child => child?.type === 'Alert');
    assert.match(alert.children[0], /Failed to acquire the Self Service API token/);
});

async function loadAuthentication({
    msalInstance = instance,
    redirectForSelfServiceAccess = () => {},
    requestSelfServiceTokenAfterSignIn = () => {},
} = {}) {
    const storage = createStorage();
    const utils = await load('../src/utils/passkeyUtils.js');
    const auth = await load('../src/hooks/passkeys/useAuthentication.js', {
        '@azure/msal-react': { useMsal: () => ({ instance: msalInstance }) },
        '../../authConfig': { loginRequest: {} },
        '../../utils/selfServiceToken': {
            requestSelfServiceTokenAfterSignIn,
            redirectForSelfServiceAccess,
        },
        '../../utils/passkeyUtils': utils,
    }, { sessionStorage: storage });
    return { auth, utils, storage };
}

test('Sign-out works without app-token dependencies, with or without a cached account', async () => {
    for (const accounts of [[account], []]) {
        const calls = [];
        const window = { location: { href: '/security' } };
        const navigation = await load('../src/components/NavigationBar.jsx', {
            '@azure/msal-react': {
                AuthenticatedTemplate: 'Authenticated',
                UnauthenticatedTemplate: 'Unauthenticated',
                useMsal: () => ({
                    instance: {
                        getAllAccounts: () => accounts,
                        clearCache: async () => { calls.push(['clear']); },
                        logoutRedirect: async request => { calls.push(['logout', request]); },
                    },
                }),
            },
            'react-bootstrap': { Navbar: 'Navbar', Button: 'Button' },
            '../authConfig': { loginRequest: {} },
        }, {
            createElement: (type, props, ...children) => ({ type, props, children }),
            React: { Fragment: 'Fragment' },
            window,
        });
        const navbar = navigation.NavigationBar().children[0];
        const authenticated = navbar.children.find(child => child?.type === 'Authenticated');
        const signOut = authenticated.children[0].children[0];
        await signOut.props.onClick();
        assert.equal(calls.length, 1);
        if (accounts.length) {
            assert.equal(calls[0][0], 'logout');
            assert.equal(calls[0][1].account, account);
        } else {
            assert.equal(calls[0][0], 'clear');
            assert.equal(window.location.href, '/');
        }
    }
});

test('List reaches the API without a local verification deadline', async () => {
    const { auth, utils, storage } = await loadAuthentication();
    let requests = 0;
    const fetcher = await load('../src/hooks/passkeys/usePasskeyFetcher.js', {
        react: {
            useState: () => [null, () => {}],
            useCallback: callback => callback,
        },
        '@azure/msal-browser': { InteractionRequiredAuthError: class extends Error {} },
        '../../services/selfServiceApiClient': {
            fetchSelfServicePasskeys: async () => { requests++; return []; },
        },
        '../../utils/selfServiceToken': { redirectForSelfServiceAccess() {} },
        '../../utils/passkeyUtils': utils,
        './useAuthentication': auth,
    });
    const result = await fetcher.usePasskeyFetcher({
        instance, account,
        onShowToast: () => assert.fail('A successful List must not request verification'),
    }).fetchPasskeys();
    assert.equal(result.length, 0);
    assert.equal(requests, 1);
    assert.equal(storage.getItem('postLoginAction'), null);
});

test('Add reaches registration without a local verification deadline', async () => {
    const { auth, utils, storage } = await loadAuthentication();
    const calls = [];
    const hook = await load('../src/hooks/passkeys/usePasskeyAddOperation.js', {
        '@azure/msal-browser': { InteractionRequiredAuthError: class extends Error {} },
        '../../services/selfServiceApiClient': {
            registerSelfServicePasskey: async () => { calls.push('add'); },
        },
        '../../utils/passkeyUtils': utils,
        './useAuthentication': auth,
    }, { setTimeout: callback => callback() });
    await hook.usePasskeyAddOperation({
        instance, account, currentPasskeys: [],
        fetchPasskeys: async () => { calls.push('list'); },
        onShowToast: toast => assert.notEqual(toast.type, 'sessionExpiredWithAction'),
    }).handleAddPasskey();
    assert.deepEqual(calls, ['add', 'list']);
    assert.equal(storage.getItem('postLoginAction'), null);
});

test('Add verification failures preserve pending Add and offer Next without a List preflight', async () => {
    class InteractionRequiredAuthError extends Error {}
    for (const [error, redirect] of [
        [new InteractionRequiredAuthError('Interaction required'), 'api-redirect'],
        [Object.assign(new Error('Token expired'), { status: 401 }), 'sign-in'],
        [new Error('AADSTS7006105: Downstream token acquisition failed'), 'sign-in'],
    ]) {
        const calls = [];
        const toasts = [];
        const { auth, utils, storage } = await loadAuthentication({
            msalInstance: {
                ...instance,
                getAllAccounts: () => [account],
                loginRedirect: async () => { calls.push('sign-in'); },
            },
            redirectForSelfServiceAccess: async () => { calls.push('api-redirect'); },
            requestSelfServiceTokenAfterSignIn: () => { calls.push('schedule-api-token'); },
        });
        const hook = await load('../src/hooks/passkeys/usePasskeyAddOperation.js', {
            '@azure/msal-browser': { InteractionRequiredAuthError },
            '../../services/selfServiceApiClient': {
                registerSelfServicePasskey: async () => { calls.push('add'); throw error; },
            },
            '../../utils/passkeyUtils': utils,
            './useAuthentication': auth,
        });
        await hook.usePasskeyAddOperation({
            instance, account, currentPasskeys: [],
            fetchPasskeys: async () => { calls.push('list'); },
            onShowToast: toast => toasts.push(toast),
        }).handleAddPasskey();
        assert.deepEqual(calls, ['add']);
        assert.deepEqual(JSON.parse(storage.getItem('postLoginAction')), { action: 'add' });
        const next = toasts.find(toast => toast.action?.label === 'Next');
        assert.ok(next);
        if (!(error instanceof InteractionRequiredAuthError)) {
            assert.equal(toasts[0].title, 'Error adding passkey');
            assert.ok(toasts[0].message.includes(error.message));
        }
        await next.action.onClick();
        assert.equal(calls.includes(redirect), true);
        assert.equal(calls.includes('schedule-api-token'), redirect === 'sign-in');
    }
});

test('An unrelated Add API failure shows an error without queuing verification', async () => {
    const { auth, utils, storage } = await loadAuthentication();
    const toasts = [];
    const calls = [];
    const hook = await load('../src/hooks/passkeys/usePasskeyAddOperation.js', {
        '@azure/msal-browser': { InteractionRequiredAuthError: class extends Error {} },
        '../../services/selfServiceApiClient': {
            registerSelfServicePasskey: async () => {
                calls.push('add');
                throw Object.assign(new Error('Registration denied'), { status: 403 });
            },
        },
        '../../utils/passkeyUtils': utils,
        './useAuthentication': auth,
    });
    await hook.usePasskeyAddOperation({
        instance, account, currentPasskeys: [],
        fetchPasskeys: async () => { calls.push('list'); },
        onShowToast: toast => toasts.push(toast),
    }).handleAddPasskey();
    assert.deepEqual(calls, ['add', 'list']);
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].title, 'Error adding passkey');
    assert.equal(storage.getItem('postLoginAction'), null);
});

test('A post-add List verification failure never replays the completed registration', async () => {
    class InteractionRequiredAuthError extends Error {}
    for (const error of [
        new InteractionRequiredAuthError('Interaction required'),
        new Error('AADSTS7006105: Downstream token acquisition failed'),
    ]) {
        const { auth, utils, storage } = await loadAuthentication();
        const toasts = [];
        const calls = [];
        const hook = await load('../src/hooks/passkeys/usePasskeyAddOperation.js', {
            '@azure/msal-browser': { InteractionRequiredAuthError },
            '../../services/selfServiceApiClient': {
                registerSelfServicePasskey: async () => { calls.push('add'); },
            },
            '../../utils/passkeyUtils': utils,
            './useAuthentication': auth,
        }, {
            setTimeout: (callback, delay) => {
                assert.equal(delay, 2000);
                callback();
            },
        });
        await hook.usePasskeyAddOperation({
            instance, account, currentPasskeys: [],
            fetchPasskeys: async () => {
                calls.push('list');
                storage.setItem('postLoginAction', JSON.stringify({ action: 'list' }));
                throw error;
            },
            onShowToast: toast => toasts.push(toast),
        }).handleAddPasskey();
        assert.deepEqual(calls, ['add', 'list']);
        assert.equal(toasts.length, 1);
        assert.equal(toasts[0].title, 'Passkey added');
        assert.deepEqual(JSON.parse(storage.getItem('postLoginAction')), { action: 'list' });
    }
});

test('Delete requires confirmation without a local verification deadline', async () => {
    const { auth, utils, storage } = await loadAuthentication();
    const state = [];
    const calls = [];
    let cursor = 0;
    const passkey = {
        id: 'test-passkey', name: 'Test passkey',
        deleteHref: '/api/v1.0/me/methods/fido/test-passkey',
    };
    const hook = await load('../src/hooks/passkeys/usePasskeyDeleteOperation.js', {
        '@azure/msal-browser': { InteractionRequiredAuthError: class extends Error {} },
        react: {
            useState(initial) {
                const index = cursor++;
                if (!(index in state)) state[index] = initial;
                return [state[index], value => { state[index] = value; }];
            },
        },
        '../../services/selfServiceApiClient': {
            deleteSelfServicePasskey: async () => { calls.push('delete'); },
        },
        '../../utils/passkeyUtils': utils,
        './useAuthentication': auth,
    }, { setTimeout: callback => callback() });
    const render = () => {
        cursor = 0;
        return hook.usePasskeyDeleteOperation({
            instance, account, currentPasskeys: [passkey],
            fetchPasskeys: async () => { calls.push('list'); },
            onShowToast: toast => assert.notEqual(toast.type, 'sessionExpiredWithAction'),
        });
    };
    await render().initiate(passkey);
    assert.equal(calls.length, 0);
    const confirmation = render();
    assert.equal(confirmation.modalProps.show, true);
    await confirmation.modalProps.onConfirm();
    assert.deepEqual(calls, ['delete', 'list']);
    assert.equal(render().modalProps.show, false);
    assert.equal(storage.getItem('postLoginAction'), null);
});

test('After verification, pending Delete reopens confirmation without List or automatic deletion', async () => {
    const { auth, utils, storage } = await loadAuthentication();
    const passkey = {
        id: 'test-passkey', name: 'Test passkey',
        deleteHref: '/api/v1.0/me/methods/fido/test-passkey',
    };
    const state = [];
    const toasts = [];
    const requests = [];
    let cursor = 0;
    let needsVerification = true;
    const deletion = await load('../src/hooks/passkeys/usePasskeyDeleteOperation.js', {
        react: {
            useState(initial) {
                const index = cursor++;
                if (!(index in state)) state[index] = initial;
                return [state[index], value => { state[index] = value; }];
            },
        },
        '@azure/msal-browser': { InteractionRequiredAuthError: class extends Error {} },
        '../../services/selfServiceApiClient': {
            deleteSelfServicePasskey: async () => {
                requests.push('delete');
                if (needsVerification) throw new Error('AADSTS7006105: Verification required');
            },
        },
        '../../utils/selfServiceToken': { redirectForSelfServiceAccess() {} },
        '../../utils/passkeyUtils': utils,
        './useAuthentication': auth,
    }, { setTimeout: callback => callback() });
    const fetchPasskeys = async () => { requests.push('list'); return []; };
    const renderDelete = () => {
        cursor = 0;
        return deletion.usePasskeyDeleteOperation({
            instance, account, currentPasskeys: [],
            fetchPasskeys, onShowToast: toast => toasts.push(toast),
        });
    };
    await renderDelete().initiate(passkey);
    await renderDelete().modalProps.onConfirm();
    assert.deepEqual(requests, ['delete']);
    assert.equal(toasts[0].title, 'Error deleting passkey');
    assert.equal(toasts[1].action.label, 'Next');
    assert.equal(JSON.parse(storage.getItem('postLoginAction')).action, 'delete');

    needsVerification = false;
    const effects = [];
    const section = await load('../src/components/passkeys/PasskeysSection.jsx', {
        react: { useEffect: effect => effects.push(effect) },
        '@azure/msal-react': {
            useMsal: () => ({
                instance: { getActiveAccount: () => account }, accounts: [account],
            }),
        },
        'react-bootstrap': { Card: 'Card' },
        './components/PasskeysHeader': { default: 'Header' },
        './components/PasskeysList': { default: 'List' },
        './components/DeleteModal': { default: 'DeleteModal' },
        '../../utils/passkeyUtils': utils,
        '../../hooks/passkeys': {
            usePasskeyFetcher: () => ({ passkeys: [], fetchPasskeys }),
            usePasskeyAddOperation: () => ({}),
            usePasskeyDeleteOperation: renderDelete,
            useAuthentication: auth.useAuthentication,
        },
    }, {
        createElement: (type, props, ...children) => ({ type, props, children }),
        React: { Fragment: 'Fragment' },
    });
    section.default({ onShowToast: toast => toasts.push(toast) });
    effects.forEach(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
    const confirmation = renderDelete();
    assert.equal(confirmation.modalProps.show, true);
    assert.equal(confirmation.modalProps.passkey.id, passkey.id);
    assert.equal(storage.getItem('postLoginAction'), null);
    assert.deepEqual(requests, ['delete']);
    await confirmation.modalProps.onConfirm();
    assert.deepEqual(requests, ['delete', 'delete', 'list']);
});

test('List still requests verification for token-interaction and downstream API errors', async () => {
    class InteractionRequiredAuthError extends Error {}
    for (const error of [
        new InteractionRequiredAuthError('Interaction required'),
        new Error('AADSTS7006105: Downstream token acquisition failed'),
        Object.assign(new Error('Token expired'), { status: 401 }),
    ]) {
        const { auth, utils, storage } = await loadAuthentication();
        const toasts = [];
        let requests = 0;
        const fetcher = await load('../src/hooks/passkeys/usePasskeyFetcher.js', {
            react: {
                useState: () => [null, () => {}],
                useCallback: callback => callback,
            },
            '@azure/msal-browser': { InteractionRequiredAuthError },
            '../../services/selfServiceApiClient': {
                fetchSelfServicePasskeys: async () => { requests++; throw error; },
            },
            '../../utils/selfServiceToken': { redirectForSelfServiceAccess() {} },
            '../../utils/passkeyUtils': utils,
            './useAuthentication': auth,
        });
        const result = await fetcher.usePasskeyFetcher({
            instance, account,
            onShowToast: toast => toasts.push(toast),
        }).fetchPasskeys();
        assert.equal(result, null);
        assert.equal(requests, 1);
        assert.equal(toasts.length, 1);
        assert.equal(toasts[0].action.label, 'Next');
        assert.equal(JSON.parse(storage.getItem('postLoginAction')).action, 'list');
    }
});

test('Expiry logs distinguish page and API tokens without printing credentials', async () => {
    const now = 1800000000000;
    for (const { forceRefresh, expiresOn, secondsRemaining } of [
        { forceRefresh: false, expiresOn: new Date(now + 480000), secondsRemaining: 480 },
        { forceRefresh: true, expiresOn: new Date(now + 360000), secondsRemaining: 360 },
        { forceRefresh: false, expiresOn: null, secondsRemaining: null },
    ]) {
        const logs = [];
        const globals = {
            console: { ...console, log: (...args) => logs.push(args) },
            Date: class extends Date {
                static now() { return now; }
            },
        };
        const result = {
            ...tokenResult(1000),
            idToken: 'test-id-token',
            expiresOn,
            fromCache: !forceRefresh,
        };
        const tokenInstance = {
            acquireTokenSilent: async request => {
                assert.equal(request.forceRefresh, forceRefresh);
                return result;
            },
        };
        const pageTokens = await load('../src/utils/tokenUtils.js', {}, globals);
        const apiTokens = await load('../src/utils/selfServiceToken.js', {
            '../authConfig': {
                selfServiceApiConfig: {
                    exchangeAuthority: 'https://login.example.test/tenant',
                    scope: 'api://test/ReadWrite',
                    claims: '{}',
                    exchangeRedirectUri: 'https://app.example.test/',
                },
            },
        }, globals);

        const pageResult = await pageTokens.getAccessToken(
            tokenInstance, [account], {}, forceRefresh);
        const apiToken = await apiTokens.getSelfServiceAccessToken(
            tokenInstance, account, forceRefresh);
        assert.equal(pageResult.token, result.accessToken);
        assert.equal(apiToken, result.accessToken);

        for (const label of ['Page access token expiry:', 'Self Service API token expiry:']) {
            const entries = logs.filter(([message]) => message === label);
            assert.equal(entries.length, 1);
            assert.deepEqual(JSON.parse(JSON.stringify(entries[0][1])), {
                expiresOn: expiresOn?.toISOString() ?? null,
                secondsRemaining,
                fromCache: !forceRefresh,
                forceRefresh,
            });
        }
        const output = JSON.stringify(logs);
        assert.equal(output.includes(result.accessToken), false);
        assert.equal(output.includes(result.idToken), false);
        assert.equal(output.includes(account.homeAccountId), false);
    }
});
