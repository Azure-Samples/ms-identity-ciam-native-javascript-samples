export interface SuccessResponseType {
  continuation_token?: string;
  challenge_type?: string;
}

export interface ErrorResponseType {
  error: string;
  error_description: string;
  error_codes: number[];
  timestamp: string;
  trace_id: string;
  correlation_id: string;
}

export interface TokenResponseType {
  token_type: string;
  scope: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
  id_token: string;
}

export interface ChallengeResponse {
  binding_method: string;
  challenge_channel: string;
  challenge_target_label: string;
  challenge_type: string;
  code_length: number;
  continuation_token: string;
  interval: number;
}

export interface ChallengeResetResponse {
  continuation_token: string;
  expires_in: number;
}

export interface ResetPasswordSubmitResponse {
  continuation_token: string;
  poll_interval: number;
}
