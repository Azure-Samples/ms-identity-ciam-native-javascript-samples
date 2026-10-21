import { appConfig, selfServiceApiConfig } from "./src/authConfig.js";

const tokenProxyUrl = new URL(appConfig.proxyDomain);

export const proxyConfig = {
    localApiPath: tokenProxyUrl.pathname,
    port: Number(tokenProxyUrl.port) || 80,
    tokenAuthority: `https://login.microsoftonline.com/${appConfig.tenantId}`,
    selfServicePrefix: new URL(selfServiceApiConfig.authority).pathname,
    selfServiceAuthority: selfServiceApiConfig.exchangeAuthority,
};
