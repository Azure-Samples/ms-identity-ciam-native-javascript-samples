import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { msalConfig } from "./src/authConfig.js";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const certPath = path.resolve(
        __dirname,
        env.VITE_SSL_CERT || "auth-cert.pem",
    );
    const keyPath = path.resolve(__dirname, env.VITE_SSL_KEY || "auth-key.pem");
    const hasSSL = fs.existsSync(certPath) && fs.existsSync(keyPath);

    const authorityUrl = new URL(msalConfig.auth.authority);
    const apiTargetOrigin = authorityUrl.origin; // e.g. https://login.microsoftonline.com
    const apiTenantPath = authorityUrl.pathname.replace(/\/$/, ""); // e.g. /<tenant>

    return {
        plugins: [react()],
        server: {
            host: env.VITE_HOST,
            port: Number(env.VITE_PORT) || 3000,
            https: hasSSL
                ? {
                    cert: fs.readFileSync(certPath),
                    key: fs.readFileSync(keyPath),
                }
                : undefined,
            hmr: hasSSL ? { protocol: "wss", host: env.VITE_HOST } : undefined,
            // Dev-only proxy for the My Account credential API.
            //
            // Origin note: the browser calls `/myaccount-api/...` as a RELATIVE
            // path, so it resolves against the PAGE origin (scheme+host+port the
            // app is served from) -> the request is SAME-ORIGIN -> the browser
            // never runs a CORS check. 
            // 
            // Vite (server-side, no browser involved)
            // then forwards it to the API. `changeOrigin: true` rewrites the
            // outgoing Host header to the target's origin so the upstream sees a
            // request that appears to originate from itself. This sidesteps the
            // CORS block the data-plane API returns for SPA origins.
            //
            // Both the target origin and the tenant prefix are derived from
            // msalConfig.auth.authority above, so there is nothing to keep in
            // sync by hand.
            // proxy: {
            //     "/myaccount-api": {
            //         target: apiTargetOrigin,
            //         changeOrigin: true,
            //         secure: true,
            //         rewrite: (p) =>
            //             p.replace(/^\/myaccount-api/, apiTenantPath),
            //         // Logs the hidden server-side leg (Vite -> API) to the
            //         // terminal running `npm run dev`. Not visible in the browser
            //         // DevTools because this hop never touches the browser.
            //         configure: (proxy) => {
            //             proxy.on("proxyReq", (proxyReq, req) => {
            //                 console.log(
            //                     `\n[proxy ->] ${req.method} https://${proxyReq.getHeader("host")}${proxyReq.path}`,
            //                 );
            //                 console.log(
            //                     `[proxy ->]   Host: ${proxyReq.getHeader("host")}` +
            //                         `  Origin: ${proxyReq.getHeader("origin") || "(none)"}` +
            //                         `  Authorization: ${proxyReq.getHeader("authorization") ? "Bearer <present>" : "(none)"}`,
            //                 );
            //             });
            //             proxy.on("proxyRes", (proxyRes, req) => {
            //                 console.log(
            //                     `[proxy <-] ${proxyRes.statusCode} ${req.method} ${req.url}`,
            //                 );
            //                 console.log(
            //                     `[proxy <-]   access-control-allow-origin: ${proxyRes.headers["access-control-allow-origin"] || "(none)"}`,
            //                 );
            //             });
            //             proxy.on("error", (err, req) => {
            //                 console.error(
            //                     `[proxy x] ${req.method} ${req.url} -> ${err.message}`,
            //                 );
            //             });
            //         },
            //     },
            // },
        },
        build: {
            outDir: "build",
        },
    };
});
