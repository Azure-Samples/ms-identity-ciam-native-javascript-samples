# Instructions for AngularJS Native Auth Sample

This folder contains a sample project demonstrating Microsoft Identity CIAM (Customer Identity and Access Management) integration using AngularJS with native authentication and a CORS proxy.

## Features

### Native Authentication with MSAL Custom Auth SDK
This sample app leverages the `@azure/msal-browser/custom-auth` SDK to implement secure, standards-based native authentication flows with Microsoft Identity CIAM. All authentication logic is handled on the client side, and API calls are securely proxied to the backend using a CORS proxy.

#### Sign-in
- Supports both password-based and passwordless authentication.
- Users sign in with their email as the username.
- Password-based: Enter email and password to authenticate.
- Passwordless: Enter email to receive a one-time passcode (OTP) for authentication.
- Handles authentication errors and displays appropriate messages.

#### Sign-up
- New users can register using either:
  - Email + password
  - Email + OTP (passwordless registration)
- During registration, users provide required attributes such as first name, last name, job title, city, country, email, and password (if applicable).
- The sign-up flow may include email verification or additional steps as required by the backend.
- Handles validation and error feedback for user input.

#### Self-Service Password Reset (SSPR)
- Users can initiate a self-serve password reset if they forget their password.
- The password reset flow uses email OTP for authentication and verification.
- Guides users through requesting a reset code, verifying their identity, and setting a new password.
- Handles errors such as invalid or expired reset codes.

## UI
- The app features a top menu with links for Sign In, Sign Up, Reset Password, and Logout, matching the React sample app's layout and navigation.

## Folder Structure

```
angularjs-sample/
├── cors.js                # Local CORS proxy server
├── package.json           # Project dependencies and scripts
├── proxy.config.js        # Proxy configuration for backend API
├── tsconfig.json          # TypeScript configuration
├── src/
│   ├── main.ts            # Entry point for the AngularJS app
│   └── app/               # All app-related components and services
│       └── ...
└── ...other config and support files
```

## Prerequisites
- Node.js 16.x or later
- npm 7.x or later

## Setup Steps

1. Install dependencies:
   ```sh
   npm install
   ```
2. Configure the CORS proxy in `proxy.config.js`.
3. Start the CORS proxy:
   ```sh
   npm run cors
   ```
4. Start the AngularJS app:
   ```sh
   npm start
   ```

The app will be available at http://localhost:4200.

## Notes
- Ensure the CORS proxy is running if your frontend needs to communicate with a backend API that does not allow cross-origin requests.
- Update `proxy.config.js` as needed for your environment.

## License
This project is licensed under the MIT License.
