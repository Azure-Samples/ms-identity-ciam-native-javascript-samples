import { CLIENT_ID, ENV } from "../config";
import { postRequest } from "./RequestClient";
import { ChallengeForm, ChallengeRequest, ResetPasswordStartRequest, ResetPasswordSubmitForm, ResetPasswordSubmitRequest } from "./RequestTypes";
import { ChallengeResetResponse, ChallengeResponse, ResetPasswordSubmitResponse } from "./ResponseTypes";

export const resetStart = async ({ username }: { username: string }) => {
  const payloadExt: ResetPasswordStartRequest = {
    username,
    client_id: CLIENT_ID,
    challenge_type: "oob redirect",
  };

  return await postRequest(ENV.urlResetPwdStart, payloadExt);
};

export const resetChallenge = async ({ continuation_token }: { continuation_token: string }): Promise<ChallengeResponse> => {
  const payloadExt: ChallengeRequest = {
    continuation_token,
    client_id: CLIENT_ID,
    challenge_type: "oob redirect",
  };

  return await postRequest(ENV.urlResetPwdChallenge, payloadExt);
};

export const resetSubmitOTP = async (payload: ChallengeForm): Promise<ChallengeResetResponse> => {
  const payloadExt = {
    client_id: CLIENT_ID,
    continuation_token: payload.continuation_token,
    oob: payload.oob,
    grant_type: "oob",
  };

  return await postRequest(ENV.urlResetPwdContinue, payloadExt);
};

export const resetSubmitNewPassword = async (payload: ResetPasswordSubmitForm): Promise<ResetPasswordSubmitResponse> => {
  const payloadExt: ResetPasswordSubmitRequest = {
    client_id: CLIENT_ID,
    continuation_token: payload.continuation_token,
    new_password: payload.new_password,
  };

  return await postRequest(ENV.urlResetPwdSubmit, payloadExt);
};

export const resetPoll = async (continuation_token: string): Promise<ChallengeResetResponse> => {
  const payloadExt = {
    client_id: CLIENT_ID,
    continuation_token,
  };
  return await postRequest(ENV.urlResetPwdPollComp, payloadExt);
};
