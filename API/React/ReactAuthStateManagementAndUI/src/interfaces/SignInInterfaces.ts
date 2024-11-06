export interface SignInChallengeRequest {
  client_id: string;
  challenge_type: string;
  continuation_token: string;
}

export interface SignInStartRequest {
  client_id: string;
  challenge_type: string;
  username: string;
}


export interface SignInTokenRequest {
    client_id: string;
    grant_type: string;
    continuation_token: string;
    scope: string;
    password?: string;
    oob?: string;
  }