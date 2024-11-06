/**
 * Configuration for the Sample App Authentication with API. 
 * Client configured for registration and login with password.
 */

export const CLIENT_ID = "Enter_the_Application_Id_Here";

const BASE_API_URL = `http://localhost:3001/api`;
const REDIRECT_URI = "https://localhost:3000";

// DEV ENDPOINTS
export const ENV = {
  REDIRECT_URI,
  urlOauthInit: `${BASE_API_URL}/oauth2/v2.0/initiate`,
  urlOauthChallenge: `${BASE_API_URL}/oauth2/v2.0/challenge`,
  urlOauthToken: `${BASE_API_URL}/oauth2/v2.0/token`,

  urlSignupStart: `${BASE_API_URL}/signup/v1.0/start`,
  urlSignupChallenge: `${BASE_API_URL}/signup/v1.0/challenge`,
  urlSignupContinue: `${BASE_API_URL}/signup/v1.0/continue`,

  urlResetPwdStart: `${BASE_API_URL}/resetpassword/v1.0/start`,
  urlResetPwdChallenge: `${BASE_API_URL}/resetpassword/v1.0/challenge`,
  urlResetPwdContinue: `${BASE_API_URL}/resetpassword/v1.0/continue`,
  urlResetPwdSubmit: `${BASE_API_URL}/resetpassword/v1.0/submit`,
  urlResetPwdPollComp: `${BASE_API_URL}/resetpassword/v1.0/poll_completion`,
};
