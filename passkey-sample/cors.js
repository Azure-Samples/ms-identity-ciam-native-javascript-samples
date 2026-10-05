import http from "http";
import https from "https";
import { proxyConfig } from "./proxy.config.js";

const extraHeaders = [
    "x-client-SKU",
    "x-client-VER",
    "x-client-OS",
    "x-client-CPU",
    "x-client-current-telemetry",
    "x-client-last-telemetry",
    "client-request-id",
];

function forwardRequest(req, res, targetUrl, corsHeaders, pathname) {
    if (!targetUrl) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
    }

    console.log("Incoming request -> " + req.url + " ===> " + pathname);

    const newHeaders = {};
    for (let [key, value] of Object.entries(req.headers)) {
        if (key !== 'origin') {
            newHeaders[key] = value;
        }
    }

    const proxyReq = https.request(
        targetUrl, // CodeQL [SM04580] Targets are built from configured, fixed upstream hosts.
        {
            method: req.method,
            headers: {
                ...newHeaders,
                host: new URL(targetUrl).hostname,
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
}

http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://localhost:${proxyConfig.port}`);

    // Set CORS headers for all responses including OPTIONS
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, " + extraHeaders.join(", "),
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400", // 24 hours
    };

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    if (reqUrl.pathname.startsWith(proxyConfig.localApiPath)) {
        const targetUrl = proxyConfig.tokenAuthority + (reqUrl.pathname ? reqUrl.pathname.replace(proxyConfig.localApiPath, "") : "") + (reqUrl.search || "");

        forwardRequest(req, res, targetUrl, corsHeaders, reqUrl.pathname);
    } else if (reqUrl.pathname.startsWith(`${proxyConfig.selfServicePrefix}/`)) {
        if (req.method === "DELETE") {
            forwardRequest(req, res, null, corsHeaders, reqUrl.pathname);
            return;
        }

        const targetUrl = proxyConfig.selfServiceAuthority + reqUrl.pathname.slice(proxyConfig.selfServicePrefix.length) + (reqUrl.search || "");
        forwardRequest(req, res, targetUrl, corsHeaders, reqUrl.pathname);
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    }
}).listen(proxyConfig.port, () => {
    console.log("CORS proxy running on http://localhost:3001");
    console.log("Proxying from " + proxyConfig.localApiPath + " ===> " + proxyConfig.tokenAuthority);
    console.log("Proxying from " + proxyConfig.selfServicePrefix + " ===> " + proxyConfig.selfServiceAuthority);
});
