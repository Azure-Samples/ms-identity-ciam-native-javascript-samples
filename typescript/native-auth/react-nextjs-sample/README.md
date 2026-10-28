# React Next.js Native Auth Sample

This folder contains a sample project demonstrating Microsoft Identity CIAM (Customer Identity and Access Management) integration using Next.js (React) with native authentication and a CORS proxy.

## Features

### Native Authentication with MSAL Custom Auth SDK
This sample app leverages the `@azure/msal-browser/custom-auth` SDK to implement secure, standards-based native authentication flows with Microsoft Identity CIAM. All authentication logic is handled on the client side, and API calls are securely proxied to the backend using a CORS proxy.

#### Sign-in
- Supports both password-based and passwordless authentication.
- Users sign in with their email as the username.
- Password-based: Enter email and password to authenticate.
- Passwordless: Enter email to receive a one-time passcode (OTP) for authentication.
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
- The password reset flow uses email OTP for authentication and verification.
- Guides users through requesting a reset code, verifying their identity, and setting a new password.
- After successful password reset, the app automatically continues to sign in the user.
- During the automatic sign-in after password reset, users can add authentication methods if no strong auth method is registered.
- Also, during the automatic sign-in after password reset, users may be requried to complete additional verification if MFA is enabled.
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
2. Save the file.

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
│   │   ├── shared/        # Shared components and types
│   │   │   ├── components/
│   │   │   │   ├── AuthMethodRegistrationForm.tsx           # JIT auth method registration
│   │   │   │   ├── AuthMethodRegistrationChallengeForm.tsx  # JIT challenge verification
│   │   │   │   ├── MfaAuthMethodSelectionForm.tsx           # MFA method selection
│   │   │   │   ├── MfaChallengeForm.tsx                     # MFA challenge verification
│   │   │   │   ├── CodeForm.tsx                             # Reusable OTP code input
│   │   │   │   └── PasswordForm.tsx                         # Reusable password input
│   │   │   └── types/
│   │   │       └── formProperties.ts  # Shared TypeScript interfaces
│   │   ├── sign-in/       # Sign-in route and logic
│   │   │   ├── page.tsx               # Sign-in page with MFA and JIT support
│   │   │   ├── components/            # Sign-in specific components
│   │   │   └── types/                 # Sign-in specific types
│   │   ├── sign-up/       # Sign-up route and logic
│   │   │   ├── page.tsx               # Sign-up page with MFA and JIT support
│   │   │   ├── components/            # Sign-up specific components
│   │   │   └── types/                 # Sign-up specific types
│   │   ├── reset-password/# Password reset route and logic
│   │   │   ├── page.tsx               # Reset password page with JIT support
│   │   │   ├── components/            # Reset password specific components
│   │   │   └── types/                 # Reset password specific types
│   │   ├── layout.tsx     # Root layout with navigation
│   │   ├── page.tsx       # Home page
│   │   └── globals.css    # Global styles
│   └── components/        # Additional shared React components (e.g., Navbar)
│       └── ...
└── ...other config and support files
```

- All authentication flows and UI are implemented in the `src/app/` directory.
- Shared components for JIT and MFA are consolidated in `src/app/shared/components/` to promote code reuse.
- Flow-specific logic is organized in dedicated route directories (`sign-in/`, `sign-up/`, `reset-password/`).
- The CORS proxy and configuration files are at the project root.

## Development
- `src/app/page.tsx` - Main landing page
- `src/app/layout.tsx` - Root layout with navigation
- Authentication routes:
  - `src/app/sign-in/page.tsx` - Sign-in page with MFA and JIT support
  - `src/app/sign-up/page.tsx` - Sign-up page with MFA and JIT support
  - `src/app/reset-password/page.tsx` - Password reset page with JIT support
- Shared components:
  - `src/app/shared/components/` - Reusable form components for JIT and MFA flows

## Notes
- Ensure the CORS proxy is running if your frontend needs to communicate with a backend API that does not allow cross-origin requests.
- Update `proxy.config.js` as needed for your environment.
- See the project `README.md` for more specific details.

## Learn More
- [Next.js Documentation](https://nextjs.org/docs)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## Contributing
See the [contributing guide](../../CONTRIBUTING.md) to learn about our development process.

## License
This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
