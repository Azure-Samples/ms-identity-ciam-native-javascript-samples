import axios from "axios";
import { CLIENT_ID, ENV } from "config";
import { SignUpChallengeRequest, SignUpForm, SignUpStartRequest } from "interfaces/SignUpInterfaces";

export const signupStart = async (payload: SignUpForm) => {
  const payloadExt = {
    attributes:  JSON.stringify({
      given_name: payload.name,
      surname: payload.surname,
    }),
    username: payload.email,
    password: payload.password,
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
  } as SignUpStartRequest;

  const body = new URLSearchParams(payloadExt as any);
  return await axios.post(ENV.urlSignupStart, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};


export const signupChallenge = async (payload: any) => {
    const payloadExt = {
        client_id: CLIENT_ID,
        challenge_type: "password oob redirect",
        continuation_token: payload.continuation_token,
      } as SignUpChallengeRequest;

    const body = new URLSearchParams(payloadExt as any);
    return await axios.post(ENV.urlSignupChallenge, body, {
        headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        },
    });
};

export const signUpSubmitOTP = async (payload: any) => {
    const payloadExt = {
        client_id: CLIENT_ID,
        continuation_token: payload.continuation_token,
        oob: payload.oob,
        grant_type: 'oob',
      };

    const body = new URLSearchParams(payloadExt as any);
    return await axios.post(ENV.urlSignupContinue, body, {
        headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        },
    });
};

export const signUpSubmitPassword = async (payload: any) => {
    const payloadExt = {
        client_id: CLIENT_ID,
        continuation_token: payload.continuation_token,
        password: payload.password,
        grant_type: 'password ',
      };

    const body = new URLSearchParams(payloadExt as any);
    return await axios.post(ENV.urlSignupContinue, body, {
        headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        },
    });
};