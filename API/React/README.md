# Introduction 
These are simple React applications that demonstrate the usage of the Native Authentication API in front end applications.
The full documentation of the API can be found [here](https://learn.microsoft.com/en-us/entra/identity-platform/reference-native-authentication-api?tabs=emailOtp#sign-in-api-reference).

## React Authentication with Username and Password
The first application shows how to authenticate a user with username and password. The user enters their username and password and the application sends the credentials to the Native Authentication API. The API then sends the credentials to the Identity Platform for verification. If the credentials are correct, the user is authenticated and the application receives an access token. The access token can be used to access protected resources.
- `ReactAuthSimple`

## React Authentication with Email OTP
The second application shows how to authenticate a user with email OTP. The user enters their email address and the application sends the email address to the Native Authentication API. The API then sends the email address to the Identity Platform. The Identity Platform sends an OTP to the user's email address. The user enters the OTP and the application sends the OTP to the API. The API then sends the OTP to the Identity Platform for verification. If the OTP is correct, the user is authenticated and the application receives an access token. The access token can be used to access protected resources.
- `ReactAuthOTPSimple`

## Full libraries React Authentication with Redux Toolkit and Material UI for React
The third application shows how to authenticate a user with username and password. This application uses Redux Toolkit for state management and Material UI for React for the UI components to show case how to implemented a full authentication with state management and UI components.
- `ReactAuthStateAndUI`


## Sample app routes
All the sample apps have similar structure and routes.
The sample app has the following routes:
- `/` - Home page which loads the Sign In Component
- `/signin` - Loads the Sign In Component
- `/signup` - Sign Up page which loads the Sign Up Component
- `/signup/challenge` - Loads the Sign Up Challenge Component which can be the Email OTP or Phone OTP code
- `/signin/completed` - Loads the Sign In Completed Component
- `/reset` - Reset Password page which loads the Reset Password Component
- `/user` - User page which loads the User Component with details of the user decoded from the access token

## React app libraries
This application has been created with Create React App [Create React App](https://create-react-app.dev/) and uses the following libraries:
- [React Router](https://reactrouter.com/) for routing
- [Material UI for React](https://mui.com/) for UI components
- [Redux Toolkit](https://redux-toolkit.js.org/) for state management

Redux and Material UI are used in the `ReactAuthStateAndUI` application. The other applications do not use Redux or Material UI and are simpler.


## React app structure
The react app has the following structure:
- `src` - Contains the source code
  - `components` - Contains the React components
  - `pages` - Contains the main React pages like SignIn, SignUp, etc.
  - `AppRoutes.jsx` - Main routes of the sample app based on React Router library
  - `App.jsx` - The main React component
  - `index.jsx` - The entry point of the application
- `cors.js` - The CORS proxy server in Node.js

## CORS configuration for local development
Due to CORS limitation to be able to call the API from a development environment, you need to run a local proxy server that will allow the application to make requests to the Identity Platform Cross-Origin Resource Sharing (CORS) policy.
All the samples app include a CORS proxy server that forwards requests to the Tenant URL endpoints. The CORS proxy server is a simple Node.js server that listens on port 3001. 
To configure the proxy server open the `proxy.config.js` file and 
- set `tenantSubdomain` to the Tenant Subdomain. For tenant `contoso.onmicrosoft.com` tenant subdomain is `contoso`
- set `tenantId` to the Tenant Id in your Microsoft Entra portal
- set `localApiPath` to the value of the endpoint that will be called from localhost. (Recommended `/api`)
- set `port` to the port you want the CORS proxy server to run on. (Recommended `3001`)

Make sure to have the full proxy URL configured in `src/config.ts` file by setting the `const BASE_API_URL = 'http://localhost:3001/api';`;
This configuration file is read by `cors.js` which is the proxy server.

# Getting Started
These instructions will get you a copy of the project up and running on your local machine for development purposes:

1. Clone the repository
2. Run `npm install` to install the dependencies
3. Open `src/config.ts` and set the `CLIENT_ID` to the value of your application's client ID. You can find these values in the Entra portal.
3. Run `npm start` to start the development server
4. Open your browser and navigate to `http://localhost:3000/`
5. Open a new command prompt and run `npm run cors` to start a local proxy server that will allow the application to make requests to the Identity Platform Cross-Origin Resource Sharing (CORS) policy.