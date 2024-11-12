const tenantSubdomain = "Enter_the_Tenant_Subdomain_Here"; //Replace with your tenant subdomain  
const https = require('https');  

module.exports = async function (context, req) {  

    const backendBaseUrl = `${tenantSubdomain}.ciamlogin.com`;  
    const subdomainUrl = `${tenantSubdomain}.onmicrosoft.com/`;  
    const incomingPath =  req.params.path || '';  
    const options = {  
        hostname: backendBaseUrl,  
        path: `/${subdomainUrl}${incomingPath}`, 
        method: req.method, 
        headers: {  
            ...req.headers, 
            host: backendBaseUrl  
        }  
    };  
  
    return new Promise((resolve) => {  
        const proxyReq = https.request(options, (proxyRes) => {  
            let data = '';  
            proxyRes.on('data', (chunk) => {  
                data += chunk;  
            });    

            proxyRes.on('end', () => {  
                context.res = {  
                    status: proxyRes.statusCode, 
                    body: data, 
                    headers: {  
                        ...proxyRes.headers,  
                    }  
                };  

                context.done(); 
            });  
        });  

        proxyReq.on('error', (error) => {  
            context.res = {  
                status: proxyRes.statusCode, 
                body: error.message, 
                headers: {  
                    ...proxyRes.headers,  
                }  
            };  
            context.done(); 
        });  

        if (req.body) {  
            proxyReq.write(req.body);  
        }    

        proxyReq.end();  
    });  
};  