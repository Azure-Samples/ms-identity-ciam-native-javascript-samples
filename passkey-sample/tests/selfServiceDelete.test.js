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

const dc = 'ESTS-PUB-WEULR1-AZ1-FD001-001';

test('experimental deletion uses the delegated Self Service API and preserves both UI choices', async (t) => {
    const server = await createServer({ server: { middlewareMode: true, hmr: false } });
    try {
        const { deleteSelfServicePasskey } = await server.ssrLoadModule('/src/services/selfServiceApiClient.js');
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

        await t.test('DELETE encodes the ID and accepts an empty 204 response', async (t) => {
            const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
                const parsed = new URL(url);
                assert.equal(parsed.origin, 'https://auth.cmpasskeysoobselfservice.ciamlogin.com:3001');
                assert.equal(parsed.pathname, '/selfservice-api/api/v1.0/me/methods/fido/id%2Fwith%2Bspecial%3Fchars');
                assert.deepEqual(parsed.searchParams.getAll('dc'), [dc]);
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

        await t.test('Graph and Self Service buttons have distinct labels and colors', () => {
            const selected = [];
            const passkey = { id: 'test-id', model: 'Unknown', passkeyType: 'deviceBound' };
            const props = {
                passkey,
                onDelete: value => selected.push(['graph', value]),
                onSelfServiceDelete: value => selected.push(['selfService', value]),
            };
            const markup = renderToStaticMarkup(createElement(PasskeyItem, props));
            assert.match(markup, /btn-outline-danger/);
            assert.match(markup, /btn-outline-warning/);
            assert.match(markup, /Delete passkey using Microsoft Graph/);
            assert.match(markup, /Delete \(Self Service\)/);

            const list = renderToStaticMarkup(createElement(PasskeysList, {
                passkeys: [passkey],
                onDelete: props.onDelete,
                onSelfServiceDelete: props.onSelfServiceDelete,
            }));
            assert.match(list, /Delete \(Self Service\)/);
            const disabled = renderToStaticMarkup(createElement(PasskeyItem, { ...props, isLoading: true }));
            assert.equal((disabled.match(/disabled=""/g) || []).length, 2);
            assert.equal(selected.length, 0);
        });
    } finally {
        await server.close();
    }
});

test('the proxy forwards experimental DELETE to the exact CIAM endpoint without Graph', async (t) => {
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
                response.headers = {};
                callback(response);
                done();
            },
        });
    });
    await import('../cors.js');
    assert.equal(typeof handler, 'function');
    const req = Readable.from([]);
    req.url = `/selfservice-api/api/v1.0/me/methods/fido/test-id?dc=old&dc=duplicate`;
    req.method = 'DELETE';
    req.headers = { authorization: 'Bearer test-delegated-token', origin: 'https://local-test.invalid' };
    let status;
    const res = new Writable({ write(chunk, encoding, done) { done(); } });
    res.writeHead = value => { status = value; };
    const finished = once(res, 'finish');
    handler(req, res);
    await finished;
    assert.equal(status, 204);
    assert.equal(forwarded.url.origin, 'https://cmpasskeysoobselfservice.ciamlogin.com');
    assert.equal(forwarded.url.pathname, '/8d2f71d7-fbcb-4ef5-92d7-da5977cf376b/api/v1.0/me/methods/fido/test-id');
    assert.deepEqual(forwarded.url.searchParams.getAll('dc'), [dc]);
    assert.equal(forwarded.options.method, 'DELETE');
    assert.equal(forwarded.options.headers.authorization, 'Bearer test-delegated-token');
    assert.equal(forwarded.options.headers.origin, undefined);
});
