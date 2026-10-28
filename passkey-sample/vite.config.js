import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const certPath = path.resolve(
        __dirname,
        env.VITE_SSL_CERT || "auth-cert.pem",
    );
    const keyPath = path.resolve(__dirname, env.VITE_SSL_KEY || "auth-key.pem");
    const hasSSL = fs.existsSync(certPath) && fs.existsSync(keyPath);

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
            // Workaround for Node 22.21.0 HTTPS bug (shouldUpgradeCallback crash)
            // Disable WebSocket-based HMR over the HTTPS server; use polling instead
            hmr: hasSSL ? { protocol: "wss", host: env.VITE_HOST } : undefined,
        },
        build: {
            outDir: "build",
        },
    };
});
