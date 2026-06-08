import http from "http";
import https from "https";
import { appConfig } from "./src/authConfig.js";

const port = 3001;

/**
 * Proxy routes. Each incoming request whose path starts with `prefix` is
 * forwarded to `target` + (path without the prefix) + query string.
 * - /api        → token endpoint (client-credentials flow, used when BEARER_TOKEN is empty)
 * - /myaccount  → My Account passkey API; the tenant + /api/v1.0/... path is preserved,
 *                 so target is the bare host.
 */
const routes = [
    { prefix: "/myaccount", target: "https://login.microsoftonline.com" },
    { prefix: "/api", target: `https://login.microsoftonline.com/${appConfig.tenantId}` },
];

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
    const reqUrl = new URL(req.url, `http://localhost:${port}`);

    // Set CORS headers for all responses including OPTIONS
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Allow, " + extraHeaders.join(", "),
        // Expose upstream telemetry/correlation headers so the SPA can read them
        // (custom response headers are hidden from JS by default under CORS).
        "Access-Control-Expose-Headers": "x-ms-request-id, request-id, client-request-id, x-ms-ests-server, date",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400", // 24 hours
    };

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    const route = routes.find((r) => reqUrl.pathname.startsWith(r.prefix));

    if (route) {
        const domain = new URL(route.target).hostname;
        const targetUrl = route.target + reqUrl.pathname.slice(route.prefix.length) + (reqUrl.search || "");

        console.log("Incoming request -> " + req.url + " ===> " + targetUrl);

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
}).listen(port, () => {
    console.log("CORS proxy running on http://localhost:" + port);
    routes.forEach((r) => console.log("Proxying " + r.prefix + " ===> " + r.target));
});
