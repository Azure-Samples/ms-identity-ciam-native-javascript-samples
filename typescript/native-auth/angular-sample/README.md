# Angular Native Auth Sample

This folder contains a sample project demonstrating Microsoft Identity CIAM (Customer Identity and Access Management) integration using Angular with native authentication and a CORS proxy.

## Features

### Native Authentication with MSAL Custom Auth SDK
This sample app leverages the `@azure/msal-browser/custom-auth` SDK to implement secure, standards-based native authentication flows with Microsoft Identity CIAM. All authentication logic is handled on the client side, and API calls are securely proxied to the backend using a CORS proxy.

#### Sign-up
- New users can register using either:
  - Email + password
  - Email + OTP (passwordless registration)
- During registration, users provide required attributes such as first name, last name, job title, city, country, email, and password (if applicable).
- The sign-up flow may include email verification or additional steps as required by the backend.
- Handles validation and error feedback for user input.

#### Sign-in
- Supports both password-based and passwordless authentication.
- Users sign in with their email as the username.
- Password-based: Enter email and password to authenticate.
- Passwordless: Enter email to receive a one-time passcode (OTP) for authentication.
- Handles authentication errors and displays appropriate messages.

#### Self-Service Password Reset (SSPR)
- Users can initiate a self-serve password reset if they forget their password.
- The password reset flow uses email OTP for authentication and verification.
- Guides users through requesting a reset code, verifying their identity, and setting a new password.
- Handles errors such as invalid or expired reset codes.

## Getting Started

### Prerequisites
- Node.js 16.x or later
- npm 7.x or later

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Azure-Samples/ms-identity-ciam-native-javascript-samples
cd typescript/native-auth/angular-sample
```

2. Install dependencies:

```bash
npm install
```

## Configure the Sample SPA

1. Open `src/app/config/auth-config.ts` and replace the following with the values obtained from the Microsoft Entra admin center:
   - `Enter_the_Application_Id_Here` → Application (client) ID
   - `Enter_the_Tenant_Subdomain_Here` → Tenant Subdomain
2. Save the file.

## Native Auth APIs with Cross-Origin Resource Sharing
The Native Auth APIs [currently don't support](https://learn.microsoft.com/en-us/entra/identity-platform/reference-native-authentication-api?tabs=emailOtp) Cross-Origin Resource Sharing [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) so a proxy server must be setup between the web app and the APIs.

## CORS Configuration for Local Development
- The included CORS proxy server (Node.js, listens on port 3001) forwards requests to the Tenant URL endpoints.
- Configure `proxy.config.js` in the project root:
  - `tenantSubdomain`: Your tenant subdomain (e.g., `contoso` for `contoso.onmicrosoft.com`)
  - `tenantId`: Your Tenant Id
  - `localApiPath`: The endpoint called from localhost (recommended `/api`)
  - `port`: Port for the CORS proxy (recommended `3001`)

## Run Your Project and Sign In

1. Start the CORS proxy:

```bash
npm run cors
```

2. In a new terminal, start the Angular development server:

```bash
npm run start
```

The app will be available at http://localhost:4200.

## Project Structure

```
angular-sample/
├── cors.js                # Local CORS proxy server for CORS workaround
├── package.json           # Project dependencies and scripts
├── proxy.config.js        # Proxy configuration for backend API
├── angular.json           # Angular CLI configuration
├── tsconfig.json          # TypeScript configuration
├── src/
│   ├── main.ts            # Entry point for the Angular app
│   ├── styles.scss        # Global styles for the app
│   └── app/
│       ├── app.component.ts      # Root Angular component (logic)
│       ├── app.component.html    # Root Angular component (template)
│       ├── app.component.scss    # Root Angular component (styles)
│       ├── app.module.ts         # Main Angular module definition
│       ├── config/
│       │   └── auth-config.ts    # MSAL/CIAM authentication configuration
│       ├── services/
│       │   └── auth.service.ts   # Authentication service (handles MSAL logic)
│       └── components/
│           ├── navbar/
│           │   ├── navbar.component.ts    # Navbar component logic
│           │   ├── navbar.component.html  # Navbar component template
│           │   └── navbar.component.scss  # Navbar component styles
│           ├── sign-in/
│           │   ├── sign-in.component.ts   # Sign-in page logic
│           │   ├── sign-in.component.html # Sign-in page template
│           │   └── sign-in.component.scss # Sign-in page styles
│           ├── sign-up/
│           │   ├── sign-up.component.ts   # Sign-up page logic
│           │   ├── sign-up.component.html # Sign-up page template
│           │   └── sign-up.component.scss # Sign-up page styles
│           ├── reset-password/
│           │   ├── reset-password.component.ts   # Reset password page logic
│           │   ├── reset-password.component.html # Reset password page template
│           │   └── reset-password.component.scss # Reset password page styles
│           ├── welcome.component.ts        # Welcome/landing page logic
│           ├── welcome.component.html      # Welcome/landing page template
│           └── welcome.component.scss      # Welcome/landing page styles
└── ...other config and support files
```

- All authentication flows and UI are implemented in the `src/app/components/` directory.
- Shared UI and logic are in `src/app/components/` and `src/app/services/`.
- The CORS proxy and configuration files are at the project root.

## Development
- `src/app/components/welcome.component.ts` - Main landing page
- `src/app/components/navbar/navbar.component.ts` - Top navigation bar
- Authentication components:
  - `src/app/components/sign-in/sign-in.component.ts` - Sign-in page
  - `src/app/components/sign-up/sign-up.component.ts` - Sign-up page
  - `src/app/components/reset-password/reset-password.component.ts` - Password reset page

## Notes
- Ensure the CORS proxy is running if your frontend needs to communicate with a backend API that does not allow cross-origin requests.
- Update `proxy.config.js` as needed for your environment.
- See the project `README.md` for more specific details.

## Learn More
- [Angular Documentation](https://angular.io/docs)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## Contributing
See the [contributing guide](../../CONTRIBUTING.md) to learn about our development process.

## License
This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
