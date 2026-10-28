import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { createServer } from 'vite';

test('passkey creation accepts a custom name and preserves it during authentication', async (t) => {
    const server = await createServer({ server: { middlewareMode: true, hmr: false } });
    const originalCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    const storage = new Map();
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
    });
    Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { create: async () => ({
            id: 'test-credential',
            response: {
                attestationObject: new Uint8Array([1, 2, 3]).buffer,
                clientDataJSON: new Uint8Array([4, 5, 6]).buffer,
            },
        }) },
    });
    try {
        const { registerSelfServicePasskey, fetchSelfServicePasskeys } = await server.ssrLoadModule('/src/services/selfServiceApiClient.js');
        const { appConfig, selfServiceApiConfig } = await server.ssrLoadModule('/src/authConfig.js');
        const { usePasskeyAddOperation } = await server.ssrLoadModule('/src/hooks/passkeys/usePasskeyAddOperation.js');
        const { default: AddPasskeyModal } = await server.ssrLoadModule('/src/components/passkeys/components/AddPasskeyModal.jsx');
        const { default: PasskeyItem } = await server.ssrLoadModule('/src/components/passkeys/components/PasskeyItem.jsx');
        const account = { username: 'test-user' };
        const instance = { acquireTokenSilent: async () => ({ accessToken: 'test-delegated-token' }) };
        const enrollment = {
            id: 'test-credential',
            type: 'fido',
            state: 'interactionRequired',
            continuationToken: 'test-continuation',
            _links: { activate: { href: '/api/v1.0/me/methods/fido/test-credential/activate?keep=value&dc=old&dc=duplicate' } },
            publicKey: {
                challenge: 'AQID',
                user: { id: 'AQID', name: 'test-user', displayName: 'Test user' },
                rp: Object.freeze({
                    id: 'your-tenant.ciamlogin.com',
                    name: 'Test relying party',
                }),
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            },
        };

        await t.test('custom and blank names are sent correctly in the activation request', async (t) => {
            for (const name of ['  My security key  ', '  ', undefined]) {
                let saved;
                const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
                    assert.equal(options.method, 'POST');
                    assert.deepEqual(new URL(url).searchParams.getAll('dc'), [selfServiceApiConfig.apiQueryParams.dc]);
                    if (new URL(url).pathname.endsWith('/activate')) {
                        assert.equal(new URL(url).searchParams.get('keep'), 'value');
                        saved = JSON.parse(options.body);
                        return new Response(JSON.stringify({
                            id: 'test-credential', type: 'fido', displayName: saved.displayName,
                        }));
                    }
                    return new Response(JSON.stringify(enrollment));
                });
                const result = await registerSelfServicePasskey(instance, account, name);
                assert.equal(fetch.mock.callCount(), 2);
                if (name?.trim()) {
                    assert.equal(saved.displayName, 'My security key');
                } else {
                    assert.match(saved.displayName, /^passkey_\d+_/);
                }
                assert.equal(result.displayName, saved.displayName);
                assert.equal(saved.continuationToken, 'test-continuation');
                assert.equal(saved.publicKeyCredential.id, 'test-credential');
                t.mock.restoreAll();
            }
        });

        await t.test('custom RP overrides the API RP without mutation and falls back when unset', async (t) => {
            const originalCustomDomain = appConfig.customDomain;
            assert.equal(originalCustomDomain, '');
            try {
                for (const customDomain of ['login.example.com', originalCustomDomain]) {
                    appConfig.customDomain = customDomain;
                    const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
                        if (new URL(url).pathname.endsWith('/activate')) {
                            return new Response(JSON.stringify({ id: 'test-credential', type: 'fido' }));
                        }
                        const response = new Response();
                        t.mock.method(response, 'json', async () => enrollment);
                        return response;
                    });
                    const create = t.mock.method(navigator.credentials, 'create');
                    await registerSelfServicePasskey(instance, account, 'My key');
                    assert.equal(create.mock.callCount(), 1);
                    const { publicKey } = create.mock.calls[0].arguments[0];
                    assert.deepEqual(publicKey.rp, {
                        ...enrollment.publicKey.rp,
                        id: customDomain || enrollment.publicKey.rp.id,
                    });
                    assert.notEqual(publicKey.rp, enrollment.publicKey.rp);
                    assert.equal(enrollment.publicKey.rp.id, 'your-tenant.ciamlogin.com');
                    assert.equal(fetch.mock.callCount(), 2);
                    t.mock.restoreAll();
                }
            } finally {
                appConfig.customDomain = originalCustomDomain;
            }
        });

        await t.test('attachment restrictions are omitted without changing other creation requirements', async (t) => {
            for (const selection of [
                { authenticatorAttachment: 'cross-platform', requireResidentKey: true, userVerification: 'required' },
                { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
                { requireResidentKey: true, userVerification: 'required' },
                undefined,
            ]) {
                const start = {
                    ...enrollment,
                    publicKey: {
                        ...enrollment.publicKey,
                        ...(selection && { authenticatorSelection: Object.freeze(selection) }),
                        attestation: 'direct',
                        hints: ['client-device', 'security-key', 'hybrid'],
                        extensions: { hmacCreateSecret: true },
                        timeout: 60000,
                    },
                };
                const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
                    if (new URL(url).pathname.endsWith('/activate')) {
                        return new Response(JSON.stringify({ id: 'test-credential', type: 'fido' }));
                    }
                    const response = new Response();
                    t.mock.method(response, 'json', async () => start);
                    return response;
                });
                const create = t.mock.method(navigator.credentials, 'create');
                await registerSelfServicePasskey(instance, account, 'My key');
                assert.equal(create.mock.callCount(), 1);
                const { publicKey } = create.mock.calls[0].arguments[0];
                const expectedSelection = { ...selection };
                delete expectedSelection.authenticatorAttachment;
                assert.deepEqual(publicKey.authenticatorSelection, expectedSelection);
                assert.equal(Object.hasOwn(publicKey.authenticatorSelection, 'authenticatorAttachment'), false);
                assert.notEqual(publicKey.authenticatorSelection, selection);
                assert.equal(start.publicKey.authenticatorSelection, selection);
                assert.deepEqual(publicKey.rp, {
                    ...start.publicKey.rp,
                    id: appConfig.customDomain || start.publicKey.rp.id,
                });
                for (const key of ['pubKeyCredParams', 'attestation', 'hints', 'extensions', 'timeout']) {
                    assert.equal(publicKey[key], start.publicKey[key]);
                }
                assert.equal(fetch.mock.callCount(), 2);
                t.mock.restoreAll();
            }
        });

        await t.test('invalid names fail before token acquisition or registration', async (t) => {
            const fetch = t.mock.method(globalThis, 'fetch');
            await assert.rejects(registerSelfServicePasskey(instance, account, {}), /Passkey name must be a string/);
            assert.equal(fetch.mock.callCount(), 0);
        });

        await t.test('cancelling the authenticator never activates the named passkey', async (t) => {
            const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(enrollment)));
            t.mock.method(navigator.credentials, 'create', async () => {
                throw new DOMException('Cancelled', 'NotAllowedError');
            });
            await assert.rejects(registerSelfServicePasskey(instance, account, 'Cancelled key'), { name: 'NotAllowedError' });
            assert.equal(fetch.mock.callCount(), 1);
        });

        await t.test('the stored display name is mapped back into the passkey list', async (t) => {
            t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
                _embedded: { methods: [{ id: 'test-credential', type: 'fido', displayName: 'My security key' }] },
            })));
            const methods = await fetchSelfServicePasskeys(instance, account);
            assert.equal(methods[0].name, 'My security key');
        });

        const renderHook = (props) => {
            let hook;
            const Probe = () => {
                hook = usePasskeyAddOperation(props);
                return null;
            };
            renderToStaticMarkup(createElement(Probe));
            return hook;
        };

        await t.test('an expired verification caches the name without starting creation', async (t) => {
            storage.clear();
            const fetch = t.mock.method(globalThis, 'fetch');
            const toasts = [];
            const hook = renderHook({
                instance, account, ngcmfaExpiry: 1, currentPasskeys: [],
                onShowToast: toast => toasts.push(toast), fetchPasskeys: async () => [],
            });
            await hook.performAddPasskey('My named key');
            assert.deepEqual(JSON.parse(storage.get('postLoginAction')), {
                action: 'add', displayName: 'My named key',
            });
            assert.equal(fetch.mock.callCount(), 0);
            assert.equal(toasts[0].type, 'sessionExpiredWithAction');
        });

        await t.test('interactive token acquisition also preserves the chosen name', async (t) => {
            storage.clear();
            const fetch = t.mock.method(globalThis, 'fetch');
            const toasts = [];
            const hook = renderHook({
                instance: { acquireTokenSilent: async () => { throw new InteractionRequiredAuthError('interaction_required'); } },
                account, ngcmfaExpiry: Math.floor(Date.now() / 1000) + 600, currentPasskeys: [],
                onShowToast: toast => toasts.push(toast), fetchPasskeys: async () => [],
            });
            await hook.performAddPasskey('My named key');
            assert.deepEqual(JSON.parse(storage.get('postLoginAction')), {
                action: 'add', displayName: 'My named key',
            });
            assert.equal(fetch.mock.callCount(), 0);
            assert.equal(toasts[0].type, 'sessionExpiredWithAction');
        });

        await t.test('the naming form is controlled and supports confirmation and cancellation', () => {
            let confirmed = false;
            let cancelled = false;
            let prevented = false;
            const modal = AddPasskeyModal({
                show: true, name: 'My security key', onNameChange: () => {},
                onConfirm: () => { confirmed = true; },
                onCancel: () => { cancelled = true; },
            });
            const form = modal.props.children;
            const markup = renderToStaticMarkup(form);
            assert.match(markup, /Passkey name \(optional\)/);
            assert.match(markup, /value="My security key"/);
            assert.match(markup, /Create Passkey/);
            form.props.onSubmit({ preventDefault: () => { prevented = true; } });
            assert.equal(prevented, true);
            assert.equal(confirmed, true);
            modal.props.onHide();
            assert.equal(cancelled, true);
        });

        await t.test('passkey rows visibly render and escape the saved name', () => {
            const markup = renderToStaticMarkup(createElement(PasskeyItem, {
                passkey: { id: 'test', name: 'My <key>', model: 'Unknown', passkeyType: 'deviceBound' },
                onSelfServiceDelete: () => {},
            }));
            assert.match(markup, /<strong>My &lt;key&gt;<\/strong>/);
            assert.match(markup, /deviceBound/);
        });
    } finally {
        if (originalCredentials) {
            Object.defineProperty(navigator, 'credentials', originalCredentials);
        } else {
            delete navigator.credentials;
        }
        if (originalStorage) {
            Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
        } else {
            delete globalThis.sessionStorage;
        }
        await server.close();
    }
});
