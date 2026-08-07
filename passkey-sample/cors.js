import http from "http";
import https from "https";
import fs from "fs";
import { credentialApiConfig } from "./src/authConfig.js";
const proxyConfig = {
    localApiPath: "/myaccount-api",
    port: 3001,
    proxy: credentialApiConfig.exchangeAuthority,
};


const routes = [
    { prefix: proxyConfig.localApiPath, upstream: proxyConfig.proxy },
];

// Serve the proxy over HTTPS (reusing the dev cert) so the HTTPS dev page can
// call it without a mixed-content block. Falls back to HTTP if the cert is absent.
const hasSSL = fs.existsSync("./auth-cert.pem") && fs.existsSync("./auth-key.pem");
const httpsOptions = hasSSL
    ? { cert: fs.readFileSync("./auth-cert.pem"), key: fs.readFileSync("./auth-key.pem") }
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
const requestHandler = (req, res) => {
    const reqUrl = new URL(req.url, `http://localhost:${proxyConfig.port}`);

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, " + extraHeaders.join(", "),
        // "Access-Control-Allow-Credentials": "true",
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
        const domain = new URL(route.upstream).hostname;
        const targetUrl = route.upstream + reqUrl.pathname.replace(route.prefix, "") + (reqUrl.search || "");

        console.log("Incoming request -> " + req.url + " ===> " + reqUrl.pathname);
        console.log("Proxying to -> " + targetUrl);

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
};

const server = httpsOptions
    ? https.createServer(httpsOptions, requestHandler)
    : http.createServer(requestHandler);

server.listen(proxyConfig.port, () => {
    const scheme = httpsOptions ? "https" : "http";
    console.log(`CORS proxy running on ${scheme}://localhost:${proxyConfig.port}`);
    console.log("Proxying from " + proxyConfig.localApiPath + " ===> " + proxyConfig.proxy);
});
