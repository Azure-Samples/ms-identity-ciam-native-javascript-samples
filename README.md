# Microsoft Entra ID Native Authentication Samples for JavaScript

This repository contains sample applications demonstrating how to integrate Microsoft Entra ID Native Authentication in web applications using JavaScript frameworks. The samples showcase both direct API integration and SDK-based approaches for implementing secure authentication flows including sign-in, sign-up, and password reset.

## Sample Applications

### API-Based Samples
* **[React](API/React/)** - Direct integration with Native Authentication API
  * ReactAuthSimple - Username and password authentication
  * ReactAuthOTPSimple - Email OTP authentication
  * ReactAuthStateManagementAndUI - Full implementation with Redux Toolkit and Material UI

### SDK-Based Samples
* **[React Next.js](typescript/native-auth/react-nextjs-sample/)** - Native Auth SDK with Next.js framework
* **[AngularJS](typescript/native-auth/angular-sample/)** - Native Auth SDK with Angular framework

## Security Implications

**⚠️ Important: These samples are for demonstration purposes only and are not production-ready.**

The sample applications do not implement critical security controls required for production environments, including:
- **CSRF Protection**: Authentication forms lack anti-CSRF tokens, making them vulnerable to cross-site request forgery attacks
- **CORS Configuration**: The included proxy server uses permissive CORS settings (`*` origin) for development convenience

Before deploying any application based on this code, you must implement proper security measures. See the [detailed security considerations](typescript/native-auth/README.md) for comprehensive guidance on securing your application.

## Getting Started

Each sample includes its own README with specific setup instructions. Generally, you'll need to:

1. Register your application in Microsoft Entra admin center
2. Configure the application settings with your Client ID and Tenant information
3. Install dependencies and run the local development server
4. Run the CORS proxy server for local development (API samples)

For detailed instructions, refer to the README in each sample directory.