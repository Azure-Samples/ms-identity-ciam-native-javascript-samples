import axios from "axios";
import { CLIENT_ID, ENV } from "config";
import { SignInChallengeRequest, SignInTokenRequest } from "interfaces/SignInInterfaces";
import { SignInStartRequest } from "interfaces/SignUpInterfaces";

export const signInStart = async ({ username }: any) => {
  const payloadExt = {
    username,
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
  } as SignInStartRequest;

  const body = new URLSearchParams(payloadExt as any);
  return await axios.post(ENV.urlOauthInit, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const signInChallenge = async ({ continuation_token }: any) => {
  const payloadExt = {
    continuation_token: continuation_token,
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
  } as SignInChallengeRequest;

  const body = new URLSearchParams(payloadExt as any);
  return await axios.post(ENV.urlOauthChallenge, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const signInTokenRequest = async ({ continuation_token, grant_type, password, oob }: any) => {
  const payloadExt = {
    continuation_token,
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
    scope: 'openid offline_access',
    grant_type,
  } as SignInTokenRequest;

  if (grant_type === 'password') {
    payloadExt.password = password;
  }

  if (grant_type === 'oob') {
    payloadExt.oob = oob;
  }

  const body = new URLSearchParams(payloadExt as any);
  return await axios.post(ENV.urlOauthToken, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

