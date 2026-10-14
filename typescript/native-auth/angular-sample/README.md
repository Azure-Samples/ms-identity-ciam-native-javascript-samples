# Angular Native Auth Sample

This folder contains a sample project demonstrating Microsoft Identity CIAM (Customer Identity and Access Management) integration using Angular with native authentication and a CORS proxy. The home page provides a unified launcher for Native Auth V1 and V2.

## Features

### Native Authentication with MSAL Custom Auth SDK
This sample app leverages the `@azure/msal-browser/custom-auth` SDK to implement secure, standards-based native authentication flows with Microsoft Identity CIAM. All authentication logic is handled on the client side, and API calls are securely proxied to the backend using a CORS proxy.

The V2 sample requires `@azure/msal-browser` `^5.23.0`. Users can select V1 or V2 before starting sign-in, sign-up, or self-service password reset.

#### Sign-up
- New users can register using either:
  - Email + password
  - Email + OTP (passwordless registration)
- During registration, users provide required attributes such as first name, last name, job title, city, country, email, and password (if applicable).
- The sign-up flow may include email verification or additional steps as required by the backend.
- After successful registration, the app automatically continues to sign in the user.
- During the automatic sign-in after registration, users can add authentication methods (email or SMS) if no strong auth method is registered.
- Handles validation and error feedback for user input.

#### Sign-in
- Supports both password-based and passwordless authentication.
- Users sign in with their email as the username.
- Password-based: Enter email and password to authenticate.
- Passwordless: Enter email to receive a one-time passcode (OTP) for authentication.
- **Primary method selection (V2)**: If multiple first-factor methods are available, users explicitly select the method to continue with.
- **Multi-Factor Authentication (MFA)**: If MFA is required, users select a verification method and complete a second factor challenge.
- **Just-In-Time (JIT) Authentication Method Registration**: If no authentication method is registered, users can add one during sign-in.
- Handles authentication errors and displays appropriate messages.

#### Self-Service Password Reset (SSPR)
- Users can initiate a self-serve password reset if they forget their password.
- In V1, the service selects the password-reset verification channel. In V2, users can select email or SMS when multiple first-factor methods are available.
- Guides users through requesting a reset code, verifying their identity, and setting a new password.
- After successful password reset, the app automatically continues to sign in the user.
- During the automatic sign-in after password reset, users can add authentication methods if no strong auth method is registered.
- Also, during the automatic sign-in after password reset, users may be required to complete additional verification if MFA is enabled.
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
2. If needed, open `src/app/config/v2-request-config.ts` to customize the scopes and claims sent by the V2 flows.
3. Save the files.

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
│       │   ├── auth-config.ts        # MSAL/CIAM authentication configuration
│       │   └── v2-request-config.ts  # V2 scopes and claims
│       ├── services/
│       │   └── auth.service.ts   # Authentication service (handles MSAL logic)
│       └── components/
│           ├── unified-auth/      # Unified V1/V2 launcher and active flow
│           ├── shared/            # Shared reusable forms and layouts
│           │   ├── auth-method-challenge-form/
│           │   ├── auth-method-selection-form/
│           │   ├── auth-start-form/
│           │   ├── auth-step-layout/
│           │   ├── code-form/
│           │   ├── dynamic-attributes-form/
│           │   ├── method-selection-form/
│           │   ├── mfa-auth-method-selection-form/
│           │   ├── mfa-challenge-form/
│           │   ├── new-password-form/
│           │   └── password-form/
│           ├── navbar/
│           │   ├── navbar.component.ts    # Navbar component logic
│           │   ├── navbar.component.html  # Navbar component template
│           │   └── navbar.component.scss  # Navbar component styles
│           ├── v1/
│           │   ├── sign-in.component.ts
│           │   ├── sign-up.component.ts
│           │   └── reset-password.component.ts
│           ├── v2/
│           │   ├── sign-in-v2.component.ts
│           │   ├── sign-up-v2.component.ts
│           │   ├── reset-password-v2.component.ts
│           │   └── v2-flow-utils.ts
│           ├── welcome.component.ts        # Welcome/landing page logic
│           ├── welcome.component.html      # Welcome/landing page template
│           └── welcome.component.scss      # Welcome/landing page styles
└── ...other config and support files
```

The unified launcher starts each flow and keeps the active step visible. Version-specific components orchestrate SDK transitions, while the shared components provide reusable code, password, method-selection, MFA, JIT, and attribute forms.

- Authentication flows and UI are organized into separate V1 and V2 component areas.
- Shared components consolidate reusable JIT, MFA, code, password, method-selection, and attribute forms.
- The authentication service initializes the SDK and maintains shared account state.
- The CORS proxy and its configuration remain at the project root.

## Development

- The `unified-auth/` folder contains the main landing page and active-flow host.
- The `navbar/` folder contains the account status and sign-out UI.
- The `v1/` and `v2/` folders orchestrate version-specific sign-in, sign-up, and password-reset transitions.
- The `shared/` folder contains reusable forms and layouts for both versions.

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
