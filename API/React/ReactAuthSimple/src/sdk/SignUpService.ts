import { CLIENT_ID, ENV } from "../config";
import { postRequest } from "./RequestClient";
import { ChallengeForm, SignUpChallengeRequest, SignUpFormPassword, SignUpStartRequest } from "./RequestTypes";
import { ChallengeResponse } from "./ResponseTypes";

export const signupStart = async (payload: SignUpFormPassword) => {
  const payloadExt: SignUpStartRequest = {
    attributes: JSON.stringify({
      given_name: payload.name,
      surname: payload.surname,
    }),
    username: payload.username,
    password: payload.password,
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
  };

  return await postRequest(ENV.urlSignupStart, payloadExt);
};

export const signupChallenge = async (payload: ChallengeForm):Promise<ChallengeResponse> => {
  const payloadExt: SignUpChallengeRequest = {
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
    continuation_token: payload.continuation_token,
  };

  return await postRequest(ENV.urlSignupChallenge, payloadExt);
};

export const signUpSubmitOTP = async (payload: ChallengeForm) => {
  const payloadExt = {
    client_id: CLIENT_ID,
    continuation_token: payload.continuation_token,
    oob: payload.oob,
    grant_type: "oob",
  };

  return await postRequest(ENV.urlSignupContinue, payloadExt);
};

export const signUpSubmitPassword = async (payload: ChallengeForm) => {
  const payloadExt = {
    client_id: CLIENT_ID,
    continuation_token: payload.continuation_token,
    password: payload.password,
    grant_type: "password ",
  };
  return await postRequest(ENV.urlSignupContinue, payloadExt);
};
