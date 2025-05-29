/**
 * Proxy configuration for local development
 * entryPath: The path to the API on the react app ex. /api
 * proxy: The URL to proxy the requests
 */
const tenantSubdomain = "spasamples";
const tenantId = "1eb974cd-0dc5-40a6-9f68-94b19f5535c5";

const config = {
    localApiPath: "/api",
    port: 3001,
    proxy: `https://${tenantSubdomain}.ciamlogin.com/${tenantId}`,
};

module.exports = config;
