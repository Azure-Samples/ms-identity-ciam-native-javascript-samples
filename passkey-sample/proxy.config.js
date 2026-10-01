import { appConfig, credentialApiConfig } from "./src/authConfig.js";

const tokenProxyUrl = new URL(appConfig.proxyDomain);

export const proxyConfig = {
    localApiPath: tokenProxyUrl.pathname,
    port: Number(tokenProxyUrl.port) || 80,
    tokenAuthority: `https://login.microsoftonline.com/${appConfig.tenantId}`,
    myAccountPrefix: new URL(credentialApiConfig.authority).pathname,
    myAccountAuthority: credentialApiConfig.exchangeAuthority,
};
