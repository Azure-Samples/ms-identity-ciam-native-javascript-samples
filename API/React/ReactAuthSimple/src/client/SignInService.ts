import { CLIENT_ID, ENV } from "../config";
import { postRequest } from "./RequestClient";
import { ChallengeRequest, SignInStartRequest, TokenRequestType, TokenSignInType } from "./RequestTypes";
import { TokenResponseType } from "./ResponseTypes";

export const signInStart = async ({ username }: { username: string }) => {
  const payloadExt: SignInStartRequest = {
    username,
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
  };

  return await postRequest(ENV.urlOauthInit, payloadExt);
};

export const signInChallenge = async ({ continuation_token }: { continuation_token: string }) => {
  const payloadExt: ChallengeRequest = {
    continuation_token,
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
  };

  return await postRequest(ENV.urlOauthChallenge, payloadExt);
};

export const signInTokenRequest = async (request: TokenSignInType): Promise<TokenResponseType> => {
  const payloadExt: TokenRequestType = {
    ...request,
    client_id: CLIENT_ID,
    challenge_type: "password oob redirect",
    scope: "openid offline_access",
  };

  if (request.grant_type === "password") {
    payloadExt.password = request.password;
  }

  if (request.grant_type === "oob") {
    payloadExt.oob = request.oob;
  }

  return await postRequest(ENV.urlOauthToken, payloadExt);
};
