# MSAL Custom Auth Next.js Sample

This is a [Next.js](https://nextjs.org) project that demonstrates custom authentication implementation using MSAL Custom Native Auth SDK. The project showcases a modern authentication flow with sign-in, sign-up, and password reset capabilities.

## Project Structure

```
├── src/
│   ├── app/                    # Next.js app router directory
│   │   ├── sign-in/           # Sign-in route
│   │   ├── sign-up/           # Sign-up route
│   │   ├── reset-password/    # Password reset route
│   │   ├── layout.tsx         # Root layout with navigation
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   └── components/            # Shared components
│       ├── Navbar.tsx         # Navigation bar component
│       └── Navbar.module.css  # Navigation styles
```

## Features

-   Modern Next.js 14 App Router structure
-   Type-safe development with TypeScript
-   Responsive navigation with authentication routes
-   Styled using CSS Modules and global styles
-   Built-in font optimization with [Geist](https://vercel.com/font)

## Getting Started

### Prerequisites

-   Node.js 20.x or later
-   npm 10.x or later
-   yarn 4.6 or later

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Azure-Samples/ms-identity-ciam-native-javascript-samples
#If needed: cd ms-identity-ciam-native-javascript-samples
cd typescript/native-auth/react-nextjs-sample
```

2. Install dependencies:

```bash
npm install
```

## Configure the sample SPA

1. Open *src\config\auth-config.ts* and replace the following with the values obtained from the Microsoft Entra admin center:

     * `Enter_the_Application_Id_Here` and replace it with the Application (client) ID of the app you registered earlier.
     * `Enter_the_Tenant_Subdomain_Here` and replace it with the Tenant Subdomain in your Microsoft Entra portal.

1. Save the file.

## Native Auth APIs with Cross Origin Resource Sharing
The Native Auth APIs [currently don't support ](https://learn.microsoft.com/en-us/entra/identity-platform/reference-native-authentication-api?tabs=emailOtp) Cross-Origin Resource Sharing [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) so a proxy server must be setup between the web app and the APIs. 

## CORS configuration for local development
All the sample apps include a CORS proxy server that forwards requests to the Tenant URL endpoints. The CORS proxy server is a simple Node.js server that listens on port 3001. 
To configure the proxy server open the `proxy.config.js` file (in the root folder of the project) and 
- set `tenantSubdomain` to the Tenant Subdomain. For tenant `contoso.onmicrosoft.com` tenant subdomain is `contoso`
- set `tenantId` to the Tenant Id in your Microsoft Entra portal
- set `localApiPath` to the value of the endpoint that will be called from localhost. (Recommended `/api`)
- set `port` to the port you want the CORS proxy server to run on. (Recommended `3001`)

## Run your project and sign in

All the required code snippets have been added, so the application can now be called and tested in a web browser.

1. Open a new terminal by selecting **Terminal** > **New Terminal**.
1. Run the following command to start the cors proxy.

```bash
#If needed: cd ms-identity-ciam-native-javascript-samples
cd typescript/native-auth/react-nextjs-sample/
npm run cors
```

1. Open a new terminal by selecting **Terminal** > **New Terminal**.
1. Run the following command to start your web server.

```bash
#If needed: cd ms-identity-ciam-native-javascript-samples
cd typescript/native-auth/react-nextjs-sample/
npm run dev
```

## Development

-   `src/app/page.tsx` - The main landing page
-   `src/app/layout.tsx` - The root layout containing the navigation
-   Authentication routes:
    -   `src/app/sign-in/page.tsx` - Sign-in page
    -   `src/app/sign-up/page.tsx` - Sign-up page
    -   `src/app/reset-password/page.tsx` - Password reset page

## Learn More

-   [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
-   [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js) - Microsoft Authentication Library for JavaScript
-   [TypeScript Documentation](https://www.typescriptlang.org/docs/) - Learn about TypeScript

## Contributing

Please read the [contributing guide](../../CONTRIBUTING.md) to learn about our development process.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
