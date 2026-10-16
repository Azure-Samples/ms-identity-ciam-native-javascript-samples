import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthorizeProtocol } from '@azure/msal-common/browser';
import { createServer } from 'vite';
import { appConfig, loginRequest, msalConfig, routingQueryParameters, selfServiceApiConfig } from '../src/authConfig.js';
import { proxyConfig } from '../proxy.config.js';
import { withDcParameter } from '../src/utils/requestRouting.js';

const dc = 'ESTS-PUB-WEULR1-AZ1-FD001-001';
const authority = 'https://cmpasskeysoobselfservice.ciamlogin.com/8d2f71d7-fbcb-4ef5-92d7-da5977cf376b';

test('configuration shares the correct tenant, client ID, HTTPS proxy and routing', () => {
    assert.equal(msalConfig.auth.clientId, '65f43756-4f51-4298-9483-141c9f1f6ee2');
    assert.equal(msalConfig.auth.authority, authority);
    assert.equal(msalConfig.auth.redirectUri, 'https://auth.cmpasskeysoobselfservice.ciamlogin.com:3000/');
    assert.equal(msalConfig.auth.postLogoutRedirectUri, msalConfig.auth.redirectUri);
    assert.equal(appConfig.appId, msalConfig.auth.clientId);
    assert.equal(appConfig.tenantId, '8d2f71d7-fbcb-4ef5-92d7-da5977cf376b');
    assert.equal(selfServiceApiConfig.exchangeClientId, msalConfig.auth.clientId);
    assert.equal(selfServiceApiConfig.exchangeAuthority, authority);
    assert.equal(selfServiceApiConfig.exchangeRedirectUri, msalConfig.auth.redirectUri);
    assert.equal(selfServiceApiConfig.authority, 'https://auth.cmpasskeysoobselfservice.ciamlogin.com:3001/selfservice-api');
    assert.equal(appConfig.proxyDomain, 'https://auth.cmpasskeysoobselfservice.ciamlogin.com:3001/api');
    assert.equal(proxyConfig.port, 3001);
    assert.equal(proxyConfig.tokenAuthority, `https://login.microsoftonline.com/${appConfig.tenantId}`);
    assert.equal(proxyConfig.selfServiceAuthority, authority);
    assert.deepEqual(routingQueryParameters, { dc });
    assert.deepEqual(selfServiceApiConfig.apiQueryParams, { dc });
    assert.equal(loginRequest.extraQueryParameters.dc, undefined);
    assert.equal(loginRequest.tokenQueryParameters, undefined);
});

test('routing preserves other query parameters and removes duplicate dc values', () => {
    const url = new URL(withDcParameter(`${authority}/api/v1.0/me/methods?keep=value&dc=old&dc=duplicate`, dc));
    assert.equal(url.searchParams.get('keep'), 'value');
    assert.deepEqual(url.searchParams.getAll('dc'), [dc]);
});

test('MSAL discovery and authorization URLs contain exactly one dc', async (t) => {
    for (const suffix of ['', '?dc=old&dc=duplicate', `?dc=${dc}`]) {
        const requests = [];
        t.mock.method(globalThis, 'fetch', async (url) => {
            requests.push(new URL(url));
            return new Response(JSON.stringify({
                authorization_endpoint: `${authority}/oauth2/v2.0/authorize${suffix}`,
                token_endpoint: `${authority}/oauth2/v2.0/token${suffix}`,
                end_session_endpoint: `${authority}/oauth2/v2.0/logout${suffix}`,
            }));
        });
        const { body } = await msalConfig.system.networkClient.sendGetRequestAsync(
            `${authority}/v2.0/.well-known/openid-configuration`
        );
        assert.deepEqual(requests[0].searchParams.getAll('dc'), [dc]);
        for (const endpoint of Object.values(body)) {
            assert.deepEqual(new URL(endpoint).searchParams.getAll('dc'), [dc]);
        }
        const signInUrl = AuthorizeProtocol.getAuthorizeUrl(
            { authorizationEndpoint: body.authorization_endpoint },
            new Map(Object.entries({
                client_id: msalConfig.auth.clientId,
                response_type: 'code',
                ...loginRequest.extraQueryParameters,
            })),
            true,
            loginRequest.extraQueryParameters,
        );
        assert.deepEqual(new URL(signInUrl).searchParams.getAll('dc'), [dc]);
        t.mock.restoreAll();
    }
});

test('MSAL token requests preserve body, headers, HTTP errors and network errors', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.deepEqual(new URL(url).searchParams.getAll('dc'), [dc]);
        assert.equal(options.method, 'POST');
        assert.equal(options.body, 'grant_type=authorization_code&code=test');
        assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
        return new Response(JSON.stringify({ error: 'interaction_required' }), { status: 400 });
    });
    const result = await msalConfig.system.networkClient.sendPostRequestAsync(
        `${authority}/oauth2/v2.0/token?dc=old&dc=duplicate`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=authorization_code&code=test' },
    );
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'interaction_required');
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Connection failed'); });
    await assert.rejects(msalConfig.system.networkClient.sendGetRequestAsync(authority), /Connection failed/);
});

test('application tokens, Graph calls and Self Service list use dc without changing flows', async (t) => {
    const server = await createServer({ server: { middlewareMode: true, hmr: false } });
    try {
        const { getAppToken } = await server.ssrLoadModule('/src/utils/tokenUtils.js');
        const { graphDelete } = await server.ssrLoadModule('/src/services/GraphApiClient.js');
        const { fetchSelfServicePasskeys } = await server.ssrLoadModule('/src/services/selfServiceApiClient.js');
        const requests = [];
        t.mock.method(globalThis, 'fetch', async (url, options) => {
            const parsed = new URL(url);
            requests.push({ url: parsed, options });
            assert.deepEqual(parsed.searchParams.getAll('dc'), [dc]);
            if (parsed.pathname.endsWith('/token')) {
                assert.equal(new URLSearchParams(options.body).get('client_id'), msalConfig.auth.clientId);
                return new Response(JSON.stringify({ access_token: 'test-app-token' }));
            }
            if (options.method === 'DELETE') {
                return new Response(null, { status: 204 });
            }
            return new Response(JSON.stringify({ _embedded: { methods: [] } }));
        });

        await t.test('Graph deletion fails closed and application-token failures remain actionable', async (t) => {
            const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
            const cache = new Map();
            const storage = {
                getItem: key => cache.get(key) ?? null,
                setItem: (key, value) => cache.set(key, value),
                removeItem: key => cache.delete(key),
            };
            Object.defineProperty(globalThis, 'window', {
                configurable: true,
                value: { sessionStorage: storage },
            });
            try {
                const { getAppToken, getCachedAppToken } = await server.ssrLoadModule('/src/utils/tokenUtils.js');
                const { deleteUserPasskey } = await server.ssrLoadModule('/src/services/PasskeyService.js');
                const instance = { getConfiguration: () => ({ cache: { cacheLocation: 'sessionStorage' } }) };
                const tokenArgs = [appConfig.proxyDomain, appConfig.appId, 'test-only'];

                await t.test('missing tokens never send a Graph DELETE', async (t) => {
                    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
                    for (const token of [null, undefined, '', '  ']) {
                        await assert.rejects(deleteUserPasskey(token, 'test-user', 'test-passkey'), /application access token is required/);
                    }
                    assert.equal(fetch.mock.callCount(), 0);
                });

                await t.test('missing secret fails before requesting a token', async (t) => {
                    t.mock.method(console, 'error', () => {});
                    const fetch = t.mock.method(globalThis, 'fetch');
                    await assert.rejects(getAppToken(appConfig.proxyDomain, appConfig.appId, ''), /VITE_APP_SECRET/);
                    assert.equal(fetch.mock.callCount(), 0);
                });

                await t.test('invalid secret surfaces the Entra error without retrying or caching it', async (t) => {
                    cache.clear();
                    t.mock.method(console, 'error', () => {});
                    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
                        error: 'invalid_client',
                        error_description: 'AADSTS7000215: Invalid client secret provided.',
                    }), { status: 401 }));
                    await assert.rejects(getCachedAppToken(instance, ...tokenArgs), /AADSTS7000215: Invalid client secret/);
                    assert.equal(fetch.mock.callCount(), 1);
                    assert.equal(cache.size, 0);
                });

                await t.test('token responses without an access token fail explicitly', async (t) => {
                    t.mock.method(console, 'error', () => {});
                    t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
                    await assert.rejects(getAppToken(...tokenArgs), /returned no access token/);
                });

                await t.test('blank and permissionless cached tokens are replaced', async (t) => {
                    const permissionlessToken = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;
                    for (const token of ['', '  ', permissionlessToken]) {
                        cache.set('app_token_cache', JSON.stringify({ token, expiresAt: Date.now() + 3600000 }));
                        const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
                            access_token: 'test-app-token',
                        })));
                        assert.equal(await getCachedAppToken(instance, ...tokenArgs), 'test-app-token');
                        assert.equal(fetch.mock.callCount(), 1);
                        assert.equal(JSON.parse(cache.get('app_token_cache')).token, 'test-app-token');
                        t.mock.restoreAll();
                    }
                });

                await t.test('deletion sends the acquired application token', async (t) => {
                    const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
                        assert.equal(options.method, 'DELETE');
                        assert.equal(options.headers.Authorization, 'Bearer test-app-token');
                        assert.equal(new URL(url).pathname, '/beta/users/test-user/authentication/fido2Methods/test-passkey');
                        return new Response(null, { status: 204 });
                    });
                    await deleteUserPasskey('test-app-token', 'test-user', 'test-passkey');
                    assert.equal(fetch.mock.callCount(), 1);
                });

                await t.test('valid cached application tokens are reused', async (t) => {
                    const token = `e30.${Buffer.from(JSON.stringify({
                        roles: ['UserAuthMethod-Passkey.ReadWrite.All'],
                        exp: Math.floor(Date.now() / 1000) + 3600,
                    })).toString('base64url')}.test`;
                    cache.set('app_token_cache', JSON.stringify({ token, expiresAt: Date.now() + 3600000 }));
                    const fetch = t.mock.method(globalThis, 'fetch');
                    assert.equal(await getCachedAppToken(instance, ...tokenArgs), token);
                    assert.equal(fetch.mock.callCount(), 0);
                });

                await t.test('Graph JSON and plain-text errors retain their original details', async (t) => {
                    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
                        error: { code: 'InvalidAuthenticationToken', message: 'Access token is empty.' },
                    }), { status: 401 }));
                    await assert.rejects(
                        deleteUserPasskey('test-app-token', 'test-user', 'test-passkey'),
                        /InvalidAuthenticationToken: Access token is empty\./,
                    );
                    t.mock.restoreAll();
                    t.mock.method(globalThis, 'fetch', async () => new Response('Upstream unavailable', { status: 503 }));
                    await assert.rejects(
                        deleteUserPasskey('test-app-token', 'test-user', 'test-passkey'),
                        /HTTP 503: Upstream unavailable/,
                    );
                });
            } finally {
                if (originalWindow) {
                    Object.defineProperty(globalThis, 'window', originalWindow);
                } else {
                    delete globalThis.window;
                }
            }
        });
        assert.equal(await getAppToken(appConfig.proxyDomain, appConfig.appId, 'test-only'), 'test-app-token');
        await graphDelete('/users/test/authentication/fido2Methods/test?dc=old', 'test-app-token');
        const instance = {
            acquireTokenSilent: async (request) => {
                assert.equal(request.authority, authority);
                assert.deepEqual(request.scopes, [selfServiceApiConfig.scope]);
                return { accessToken: 'test-user-token' };
            },
        };
        assert.deepEqual(await fetchSelfServicePasskeys(instance, { username: 'test' }), []);
        assert.equal(requests.length, 3);
        assert.equal(requests[1].url.hostname, 'graph.microsoft.com');
        assert.equal(requests[2].url.pathname, '/selfservice-api/api/v1.0/me/methods');
    } finally {
        await server.close();
    }
});
