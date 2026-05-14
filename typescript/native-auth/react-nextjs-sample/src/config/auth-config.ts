import { CustomAuthConfiguration, LogLevel } from "@azure/msal-browser/custom-auth";
import type { CustomAuthRequestInterceptor } from "@azure/msal-browser/custom-auth";

const requestInterceptor: CustomAuthRequestInterceptor = {
    addAdditionalHeaderFields(requestUrl: URL) {
        if (requestUrl.pathname.endsWith("/oauth2/v2.0/initiate")) {
            return {
                value_1: "customer_header_1", // Will be ignored: doesn't start with "x-"
                "x-client-header": "customer_header_2", // Will be ignored: starts with reserved prefix "x-client-"
                "X-my-custom-header": "my data", // Will be added to the network request
            };
        }

        return null;
    },
};

export const customAuthConfig: CustomAuthConfiguration = {
    customAuth: {
        challengeTypes: ["password", "oob", "redirect"],
        authApiProxyUrl: "http://localhost:3001/api",
        requestInterceptor: requestInterceptor,
    },
    auth: {
        clientId: "Enter_the_Application_Id_Here",
        authority: "https://Enter_the_Tenant_Subdomain_Here.ciamlogin.com",
        redirectUri: "/",
        postLogoutRedirectUri: "",
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                }
            },
        },
    },
};
