const http = require("http");
const https = require("https");
const url = require("url");
const proxyConfig = require("./proxy.config");

const extraHeaders = [
    "x-client-SKU",
    "x-client-VER",
    "x-client-OS",
    "x-client-CPU",
    "x-client-current-telemetry",
    "x-client-last-telemetry",
    "client-request-id",
];
http.createServer((req, res) => {
    const reqUrl = url.parse(req.url);
    const proxyUrl = new URL(proxyConfig.proxy);
    const domain = proxyUrl.hostname;

    // Echo the headers the browser asks about during preflight so custom headers
    // added by a CustomAuthRequestInterceptor are accepted without having to be
    // listed here. Fall back to the static list when the request header is absent.
    const requestedHeaders = req.headers["access-control-request-headers"];
    const allowedHeaders = requestedHeaders || ("Content-Type, Authorization, " + extraHeaders.join(", "));

    // Set CORS headers for all responses including OPTIONS
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": allowedHeaders,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400", // 24 hours
    };

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    const [, tenant, endpointGroup] = reqUrl.pathname.split("/");
    const isTenantApiRequest =
        reqUrl.pathname.startsWith("/") &&
        Boolean(tenant) &&
        (endpointGroup === "api" || endpointGroup === "oauth2");

    let targetUrl;
    if (reqUrl.pathname.startsWith(proxyConfig.localApiPath + "/")) {
        targetUrl = proxyConfig.proxy + reqUrl.pathname.slice(proxyConfig.localApiPath.length) + (reqUrl.search || "");
    } else if (isTenantApiRequest) {
        // HAL links already include the service tenant, so retain only the configured origin.
        targetUrl = proxyUrl.origin + reqUrl.pathname + (reqUrl.search || "");
    }

    if (targetUrl) {

        console.log("Proxy: " + reqUrl.pathname + " -> " + targetUrl);

        const newHeaders = {};
        for (let [key, value] of Object.entries(req.headers)) {
            if (key !== 'origin') {
                newHeaders[key] = value;
            }
        }

        const proxyReq = https.request(
            targetUrl, // CodeQL [SM04580] The newly generated target URL utilizes the configured proxy URL to resolve the CORS issue and will be used exclusively for demo purposes and run locally.
            {
                method: req.method,
                headers: {
                    ...newHeaders,
                    host: domain,
                },
            },
            (proxyRes) => {
                res.writeHead(proxyRes.statusCode, {
                    ...proxyRes.headers,
                    ...corsHeaders,
                });

                proxyRes.pipe(res);
            }
        );

        proxyReq.on("error", (err) => {
            console.error("Error with the proxy request:", err);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Proxy error.");
        });

        req.pipe(proxyReq);
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    }
}).listen(proxyConfig.port, () => {
    console.log("CORS proxy running on http://localhost:3001");
    console.log("Proxying from " + proxyConfig.localApiPath + " ===> " + proxyConfig.proxy);
});
