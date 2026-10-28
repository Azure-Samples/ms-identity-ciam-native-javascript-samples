import assert from 'node:assert/strict';
import { test } from 'node:test';
import https from 'node:https';
import { Readable, Writable } from 'node:stream';
import { once } from 'node:events';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { createServer } from 'vite';
import { selfServiceApiConfig } from '../src/authConfig.js';

test('deletion uses the delegated Self Service API and exposes only its UI control', async (t) => {
    const server = await createServer({ server: { middlewareMode: true, hmr: false } });
    try {
        const { deleteSelfServicePasskey } = await server.ssrLoadModule('/src/services/selfServiceApiClient.js');
        const { usePasskeyDeleteOperation } = await server.ssrLoadModule('/src/hooks/passkeys/usePasskeyDeleteOperation.js');
        const { default: PasskeyItem } = await server.ssrLoadModule('/src/components/passkeys/components/PasskeyItem.jsx');
        const { default: PasskeysList } = await server.ssrLoadModule('/src/components/passkeys/components/PasskeysList.jsx');
        const account = { username: 'test-user' };
        const instance = {
            acquireTokenSilent: async (request) => {
                assert.equal(request.account, account);
                assert.equal(request.authority, selfServiceApiConfig.exchangeAuthority);
                assert.deepEqual(request.scopes, [selfServiceApiConfig.scope]);
                assert.equal(request.claims, selfServiceApiConfig.claims);
                return { accessToken: 'test-delegated-token' };
            },
        };

        const renderDeleteHook = (props) => {
            let hook;
            const Probe = () => {
                hook = usePasskeyDeleteOperation(props);
                return null;
            };
            renderToStaticMarkup(createElement(Probe));
            return hook;
        };

        await t.test('deletion works without an app token and refreshes the list using the Self Service flow', async (t) => {
            const passkey = { id: 'test-id', name: 'My passkey' };
            const toasts = [];
            const refresh = t.mock.fn(async () => []);
            const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
                assert.equal(new URL(url).pathname, '/selfservice-api/api/v1.0/me/methods/fido/test-id');
                assert.equal(options.method, 'DELETE');
                assert.equal(options.headers.Authorization, 'Bearer test-delegated-token');
                return new Response(null, { status: 204 });
            });
            const hook = renderDeleteHook({
                instance, account, currentPasskeys: [passkey],
                onShowToast: toast => toasts.push(toast), fetchPasskeys: refresh,
            });
            await hook.performDelete(passkey.id);
            assert.equal(fetch.mock.callCount(), 1);
            assert.equal(refresh.mock.callCount(), 1);
            assert.deepEqual(refresh.mock.calls[0].arguments, [
                { type: 'delete', passkeyId: passkey.id },
                { setLoadingState: true, showToast: false },
            ]);
            assert.equal(toasts[0].title, 'Passkey deleted');
            assert.match(toasts[0].message, /My passkey/);
            assert.equal(hook.modalProps.api, 'selfService');
        });

        await t.test('deletion requiring verification preserves the pending operation without an app token', async (t) => {
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
            try {
                const passkey = { id: 'test-id', name: 'My passkey' };
                const toasts = [];
                const refresh = t.mock.fn(async () => []);
                const redirect = t.mock.fn(async (request) => {
                    assert.deepEqual(request.scopes, [selfServiceApiConfig.scope]);
                    assert.equal(request.authority, selfServiceApiConfig.exchangeAuthority);
                });
                const fetch = t.mock.method(globalThis, 'fetch');
                const hook = renderDeleteHook({
                    instance: {
                        acquireTokenSilent: async () => { throw new InteractionRequiredAuthError('interaction_required'); },
                        acquireTokenRedirect: redirect,
                    },
                    account, currentPasskeys: [passkey], fetchPasskeys: refresh,
                    onShowToast: toast => toasts.push(toast),
                });
                await hook.performDelete(passkey.id);
                assert.equal(fetch.mock.callCount(), 0);
                assert.equal(refresh.mock.callCount(), 0);
                assert.deepEqual(JSON.parse(storage.get('postLoginAction')), {
                    action: 'delete', passkey,
                });
                assert.equal(toasts[0].type, 'sessionExpiredWithAction');
                await toasts[0].action.onClick();
                assert.equal(redirect.mock.callCount(), 1);
            } finally {
                if (originalStorage) {
                    Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
                } else {
                    delete globalThis.sessionStorage;
                }
            }
        });

        await t.test('DELETE encodes the ID and accepts an empty 204 response', async (t) => {
            const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
                const parsed = new URL(url);
                assert.equal(parsed.origin, 'https://auth.your-tenant.ciamlogin.com:3001');
                assert.equal(parsed.pathname, '/selfservice-api/api/v1.0/me/methods/fido/id%2Fwith%2Bspecial%3Fchars');
                assert.deepEqual(parsed.searchParams.getAll('dc'), [selfServiceApiConfig.apiQueryParams.dc]);
                assert.equal(options.method, 'DELETE');
                assert.equal(options.headers.Authorization, 'Bearer test-delegated-token');
                assert.equal(options.body, undefined);
                return new Response(null, { status: 204 });
            });
            await deleteSelfServicePasskey(instance, account, 'id/with+special?chars');
            assert.equal(fetch.mock.callCount(), 1);
        });

        await t.test('missing ID, account, and token cannot send deletion', async (t) => {
            const fetch = t.mock.method(globalThis, 'fetch');
            for (const id of [undefined, '', ' ']) {
                await assert.rejects(deleteSelfServicePasskey(instance, account, id), /passkey ID is required/);
            }
            await assert.rejects(deleteSelfServicePasskey(instance, null, 'test-id'), /Sign in before requesting/);
            await assert.rejects(deleteSelfServicePasskey({
                acquireTokenSilent: async () => ({ accessToken: '' }),
            }, account, 'test-id'), /user access token is required/);
            assert.equal(fetch.mock.callCount(), 0);
        });

        await t.test('authorization errors propagate for interactive verification before deletion', async (t) => {
            const fetch = t.mock.method(globalThis, 'fetch');
            const error = new InteractionRequiredAuthError('interaction_required');
            await assert.rejects(deleteSelfServicePasskey({
                acquireTokenSilent: async () => { throw error; },
            }, account, 'test-id'), err => err === error);
            assert.equal(fetch.mock.callCount(), 0);
        });

        await t.test('experimental endpoint failures retain their server message', async (t) => {
            t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
                error: { message: 'Deletion is not allowed for this credential.' },
            }), { status: 403 }));
            await assert.rejects(deleteSelfServicePasskey(instance, account, 'test-id'), /Deletion is not allowed/);
        });

        await t.test('the red icon-only delete button retains its Self Service label and callback', () => {
            const passkey = { id: 'test-id', model: 'Unknown', passkeyType: 'deviceBound' };
            const props = {
                passkey,
                onSelfServiceDelete: () => {},
            };
            const markup = renderToStaticMarkup(createElement(PasskeyItem, props));
            assert.doesNotMatch(markup, /Microsoft Graph/);
            assert.match(markup, /btn-outline-danger/);
            assert.doesNotMatch(markup, /btn-outline-warning/);
            assert.match(markup, /Delete passkey using Self Service API/);
            assert.doesNotMatch(markup, /Delete \(Self Service\)/);
            assert.equal((markup.match(/aria-label="Delete passkey/g) || []).length, 1);
            const deleteButton = markup.match(/<button[^>]*aria-label="Delete passkey[^"]*"[^>]*>([\s\S]*?)<\/button>/);
            assert.ok(deleteButton);
            assert.match(deleteButton[1], /^\s*<svg\b[\s\S]*<\/svg>\s*$/);

            const list = PasskeysList({
                passkeys: [passkey],
                onSelfServiceDelete: props.onSelfServiceDelete,
            });
            assert.equal(list.props.children[0].props.onSelfServiceDelete, props.onSelfServiceDelete);
            const listMarkup = renderToStaticMarkup(list);
            assert.match(listMarkup, /aria-label="Delete passkey using Self Service API/);
            assert.doesNotMatch(listMarkup, /Microsoft Graph/);
            const disabled = renderToStaticMarkup(createElement(PasskeyItem, { ...props, isLoading: true }));
            assert.equal((disabled.match(/disabled=""/g) || []).length, 1);
        });
    } finally {
        await server.close();
    }
});

test('the proxy forwards experimental DELETE without Graph or duplicate CORS headers', async (t) => {
    let handler;
    t.mock.method(https, 'createServer', (options, callback) => {
        handler = callback;
        return { listen: () => {} };
    });
    let forwarded;
    t.mock.method(https, 'request', (url, options, callback) => {
        forwarded = { url: new URL(url), options };
        return new Writable({
            write(chunk, encoding, done) { done(); },
            final(done) {
                const response = Readable.from([]);
                response.statusCode = 204;
                response.headers = {
                    'access-control-allow-origin': 'https://upstream.example',
                    'access-control-allow-methods': 'GET, OPTIONS',
                };
                callback(response);
                done();
            },
        });
    });
    await import('../cors.js');
    assert.equal(typeof handler, 'function');
    const req = Readable.from([]);
    req.url = `/selfservice-api/api/v1.0/me/methods/fido/test-id?keep=value&dc=old&dc=duplicate`;
    req.method = 'DELETE';
    req.headers = { authorization: 'Bearer test-delegated-token', origin: 'https://local-test.invalid' };
    let status;
    let responseHeaders;
    const res = new Writable({ write(chunk, encoding, done) { done(); } });
    res.writeHead = (value, headers) => {
        status = value;
        responseHeaders = headers;
    };
    const finished = once(res, 'finish');
    handler(req, res);
    await finished;
    assert.equal(status, 204);
    const headerNames = Object.keys(responseHeaders).map(name => name.toLowerCase());
    assert.equal(new Set(headerNames).size, headerNames.length);
    assert.equal(responseHeaders['access-control-allow-origin'], '*');
    assert.equal(responseHeaders['access-control-allow-methods'], 'GET, POST, PUT, DELETE, OPTIONS');
    assert.equal(forwarded.url.origin, 'https://your-tenant.ciamlogin.com');
    assert.equal(forwarded.url.pathname, '/Enter_the_Tenant_Id_Here/api/v1.0/me/methods/fido/test-id');
    assert.deepEqual(forwarded.url.searchParams.getAll('dc'), [selfServiceApiConfig.apiQueryParams.dc]);
    assert.equal(forwarded.url.searchParams.get('keep'), 'value');
    assert.equal(forwarded.options.method, 'DELETE');
    assert.equal(forwarded.options.headers.authorization, 'Bearer test-delegated-token');
    assert.equal(forwarded.options.headers.origin, undefined);
});
