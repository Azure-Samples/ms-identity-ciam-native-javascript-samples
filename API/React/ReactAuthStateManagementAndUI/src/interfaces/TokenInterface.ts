export interface TokenInterface {
    continuation_token: string;
    client_id: string;
    grant_type: string;
    scope: string;
    password?: string;
    oob?: string;
}