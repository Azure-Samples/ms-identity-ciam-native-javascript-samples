export function withDcParameter(url, dc) {
    const routedUrl = new URL(url);
    if (dc) {
        routedUrl.searchParams.set('dc', dc);
    } else {
        routedUrl.searchParams.delete('dc');
    }
    return routedUrl.toString();
}

export function createDcNetworkClient(dc) {
    const sendRequest = async (url, options, method) => {
        const response = await fetch(withDcParameter(url, dc), {
            method,
            headers: options?.headers,
            ...(method === 'POST' ? { body: options?.body || '' } : {}),
        });
        const body = await response.json();
        if (method === 'GET' && new URL(url).pathname.endsWith('/.well-known/openid-configuration')) {
            // Redirects bypass this client, so normalize the discovered endpoints too.
            for (const key of ['authorization_endpoint', 'token_endpoint', 'end_session_endpoint']) {
                if (typeof body?.[key] === 'string') {
                    body[key] = withDcParameter(body[key], dc);
                }
            }
        }
        return {
            headers: Object.fromEntries(response.headers.entries()),
            body,
            status: response.status,
        };
    };

    return {
        sendGetRequestAsync: (url, options) => sendRequest(url, options, 'GET'),
        sendPostRequestAsync: (url, options) => sendRequest(url, options, 'POST'),
    };
}
