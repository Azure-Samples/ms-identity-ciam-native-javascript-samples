# React Next.js Native Auth Sample

This folder contains a sample project demonstrating Microsoft Identity CIAM (Customer Identity and Access Management) integration using Next.js (React) with native authentication and a CORS proxy. The home page provides a unified launcher for Native Auth V1 and V2.

## Features

### Native Authentication with MSAL Custom Auth SDK
This sample app leverages the `@azure/msal-browser/custom-auth` SDK to implement secure, standards-based native authentication flows with Microsoft Identity CIAM. All authentication logic is handled on the client side, and API calls are securely proxied to the backend using a CORS proxy.

The V2 sample requires `@azure/msal-browser` `^5.23.0`. Users can select V1 or V2 before starting sign-in, sign-up, or self-service password reset.

#### Sign-in
- Supports both password-based and passwordless authentication.
- Users sign in with their email as the username.
- Password-based: Enter email and password to authenticate.
- Passwordless: Enter email to receive a one-time passcode (OTP) for authentication.
- **Primary method selection (V2)**: If multiple first-factor methods are available, users explicitly select the method to continue with.
- **Multi-Factor Authentication (MFA)**: If MFA is required, users select a verification method and complete a second factor challenge.
- **Just-In-Time (JIT) Authentication Method Registration**: If no authentication method is registered, users can add one during sign-in.
- Handles authentication errors and displays appropriate messages.

#### Sign-up
- New users can register using either:
  - Email + password
  - Email + OTP (passwordless registration)
- During registration, users provide required attributes such as first name, last name, job title, city, country, email, and password (if applicable).
- The sign-up flow may include email verification or additional steps as required by the backend.
- After successful registration, the app automatically continues to sign in the user.
- During the automatic sign-in after registration, users can add authentication methods (email or SMS) if no strong auth method is registered.
- Handles validation and error feedback for user input.

#### Self-Service Password Reset (SSPR)
- Users can initiate a self-serve password reset if they forget their password.
- In V1, the service selects the password-reset verification channel. In V2, users can select email or SMS when multiple first-factor methods are available.
- Guides users through requesting a reset code, verifying their identity, and setting a new password.
- After successful password reset, the app automatically continues to sign in the user.
- During the automatic sign-in after password reset, users can add authentication methods if no strong auth method is registered.
- Also, during the automatic sign-in after password reset, users may be required to complete additional verification if MFA is enabled.
- Handles errors such as invalid or expired reset codes.

For more details on the SDK, see the official Microsoft documentation.

## Getting Started

### Prerequisites
- Node.js 20.x or later (16.x+ supported)
- npm 10.x or later (7.x+ supported)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Azure-Samples/ms-identity-ciam-native-javascript-samples
cd typescript/native-auth/react-nextjs-sample
```

2. Install dependencies:

```bash
npm install
```

## Configure the Sample SPA

1. Open `src/config/auth-config.ts` and replace the following with the values obtained from the Microsoft Entra admin center:
   - `Enter_the_Application_Id_Here` → Application (client) ID
   - `Enter_the_Tenant_Subdomain_Here` → Tenant Subdomain
2. If needed, open `src/config/v2-request-config.ts` to customize the scopes and claims sent by the V2 flows.
3. Save the files.

## Native Auth APIs with Cross-Origin Resource Sharing
The Native Auth APIs [currently don't support ](https://learn.microsoft.com/en-us/entra/identity-platform/reference-native-authentication-api?tabs=emailOtp) Cross-Origin Resource Sharing [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) so a proxy server must be setup between the web app and the APIs.

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

2. In a new terminal, start the Next.js development server:

```bash
npm run dev
```

The app will be available at http://localhost:3000.

## Unified V1/V2 Flow

When users open the Next.js sample, they can choose Native Auth V1 or V2 before starting sign-in, sign-up, or password reset. After a flow starts, the app displays the form required by the current SDK state.

## Project Structure

```
react-nextjs-sample/
├── cors.js                # Local CORS proxy server
├── package.json           # Project dependencies and scripts
├── proxy.config.js        # Proxy configuration for backend API
├── next.config.ts         # Next.js configuration
├── tsconfig.json          # TypeScript configuration
├── src/
│   ├── app/               # Next.js App Router directory
│   │   ├── auth/
│   │   │   ├── AuthProvider.tsx        # SDK and shared account state
│   │   │   ├── types.ts                 # Shared flow types
│   │   │   ├── components/
│   │   │   │   ├── AuthStepLayout.tsx
│   │   │   │   ├── SocialProviderButtons.tsx
│   │   │   │   ├── account/
│   │   │   │   │   └── UserInfo.tsx
│   │   │   │   └── forms/
│   │   │   │       ├── AuthStartForm.tsx
│   │   │   │       ├── CodeForm.tsx
│   │   │   │       ├── DynamicAttributesForm.tsx
│   │   │   │       ├── MethodSelectionForm.tsx
│   │   │   │       ├── NewPasswordForm.tsx
│   │   │   │       └── PasswordForm.tsx
│   │   │   ├── v1/
│   │   │   │   ├── V1AuthEntryFlow.tsx
│   │   │   │   ├── V1MfaAndRegistrationFlow.tsx
│   │   │   │   ├── V1ResetPasswordFlow.tsx
│   │   │   │   ├── V1SignInFlow.tsx
│   │   │   │   └── V1SignUpFlow.tsx
│   │   │   └── v2/
│   │   │       ├── V2AuthEntryFlow.tsx
│   │   │       ├── V2AuthMethodFlow.tsx
│   │   │       ├── V2ResetPasswordFlow.tsx
│   │   │       ├── V2SignInFlow.tsx
│   │   │       └── V2SignUpFlow.tsx
│   │   ├── layout.tsx     # Root layout with navigation
│   │   ├── page.tsx       # Unified launcher and active flow
│   │   └── globals.css    # Global styles
│   ├── components/
│   │   ├── Navbar.tsx
│   │   └── Navbar.module.css
│   └── config/
│       ├── auth-config.ts        # MSAL/CIAM authentication configuration
│       └── v2-request-config.ts  # V2 scopes and claims
└── ...other config and support files
```

The unified page starts each flow and renders the active SDK state. Version-specific flow components handle transitions, while shared forms and account components provide the reusable UI.

- Authentication flows and UI are organized into separate V1 and V2 flow areas.
- Shared components consolidate reusable account, code, password, method-selection, and attribute UI.
- The authentication provider initializes the SDK and maintains shared account state.
- The CORS proxy and its configuration remain at the project root.

## Development

- The `app/` folder contains the unified launcher and active-flow host.
- The `auth/` folder contains the authentication provider and shared flow types.
- The `auth/v1/` and `auth/v2/` folders orchestrate version-specific sign-in, sign-up, and password-reset transitions.
- The `auth/components/` folder contains reusable forms, layouts, social-provider controls, and account UI.
- The `components/` folder contains the navbar and sign-out UI.

## Notes
- Ensure the CORS proxy is running if your frontend needs to communicate with a backend API that does not allow cross-origin requests.

## Learn More
- [Next.js Documentation](https://nextjs.org/docs)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## Contributing
See the [contributing guide](../../CONTRIBUTING.md) to learn about our development process.

## License
This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
