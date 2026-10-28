import http from "http";
import https from "https";
import fs from "fs";
import { loadEnv } from "vite";
import { proxyConfig } from "./proxy.config.js";
import { routingQueryParameters } from "./src/authConfig.js";
import { withDcParameter } from "./src/utils/requestRouting.js";

const env = loadEnv("development", process.cwd(), "VITE_");
const certPath = env.VITE_SSL_CERT || "auth-cert.pem";
const keyPath = env.VITE_SSL_KEY || "auth-key.pem";
const hasSSL = fs.existsSync(certPath) && fs.existsSync(keyPath);
const httpsOptions = hasSSL
    ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
    : null;

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
        withDcParameter(targetUrl, routingQueryParameters.dc), // CodeQL [SM04580] Targets are built from configured, fixed upstream hosts.
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

const requestHandler = (req, res) => {
    const reqUrl = new URL(req.url, `http://localhost:${proxyConfig.port}`);

    // Match Node's lowercase upstream names so CORS headers replace, not duplicate.
    const corsHeaders = {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization, " + extraHeaders.join(", "),
        "access-control-allow-credentials": "true",
        "access-control-max-age": "86400", // 24 hours
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
        const targetUrl = proxyConfig.selfServiceAuthority + reqUrl.pathname.slice(proxyConfig.selfServicePrefix.length) + (reqUrl.search || "");
        forwardRequest(req, res, targetUrl, corsHeaders, reqUrl.pathname);
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    }
};

const server = httpsOptions
    ? https.createServer(httpsOptions, requestHandler)
    : http.createServer(requestHandler);
server.listen(proxyConfig.port, () => {
    console.log(`CORS proxy running on ${httpsOptions ? "https" : "http"}://localhost:${proxyConfig.port}`);
    console.log("Proxying from " + proxyConfig.localApiPath + " ===> " + proxyConfig.tokenAuthority);
    console.log("Proxying from " + proxyConfig.selfServicePrefix + " ===> " + proxyConfig.selfServiceAuthority);
});
