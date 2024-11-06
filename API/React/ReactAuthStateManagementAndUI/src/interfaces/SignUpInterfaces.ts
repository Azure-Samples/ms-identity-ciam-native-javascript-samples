export interface SignUpStartRequest {
  client_id: string;
  username: string;
  challenge_type: string;
  password?: string;
  attributes?: Object;
}

export interface SignUpForm {
  name: string;
  surname: string;
  email: string;
  password: string;
}

export interface SignUpContinueRequest {
  continuation_token: string;
  client_id: string;
  grant_type?: string;
  oob: string;
}

export interface SignInStartRequest {
  username: string;
  client_id: string;
  tenant_id: string;
  challenge_type: string;
}

export interface SignUpChallengeRequest {
  client_id: string;
  continuation_token: string;
  challenge_type?: string;
}
