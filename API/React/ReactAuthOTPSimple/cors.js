const http = require("http");
const https = require("https");
const url = require("url");
const proxyConfig = require("./proxy.config");

http
  .createServer((req, res) => {
    const reqUrl = url.parse(req.url);
    const domain = url.parse(proxyConfig.proxy).hostname;
    if (reqUrl.pathname.startsWith(proxyConfig.localApiPath)) {
      
      const targetUrl = proxyConfig.proxy + reqUrl.pathname?.replace(proxyConfig.localApiPath, "") + (reqUrl.search || "");

      console.log("Incoming request -> " + req.url + " ===> " + reqUrl.pathname);

      const proxyReq = https.request(
        targetUrl,
        {
          method: req.method,
          headers: {
            ...req.headers,
            host: domain,
          },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode, {
            ...proxyRes.headers,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  })
  .listen(proxyConfig.port, () => {
    console.log("CORS proxy running on http://localhost:3001");
    console.log("Proxying from " + proxyConfig.localApiPath + " ===> " + proxyConfig.proxy);
  });
