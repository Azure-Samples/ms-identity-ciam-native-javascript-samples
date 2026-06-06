/**
 * Test-only constants for the passkey sample.
 *
 * BEARER_TOKEN: paste an access token here (acquired externally) to authenticate
 * calls to the My Account API (`/api/v1.0/me/*`) while testing. When set to a
 * non-empty string, SecurityPage uses it directly as the API token and SKIPS the
 * runtime client-credentials acquisition (no client secret / CORS proxy needed).
 * When left empty, the runtime-acquired token is used instead.
 *
 * ⚠️ FOR LOCAL TESTING ONLY. Do not commit a real token — treat any value you
 * paste here as a secret and clear it before committing (or gitignore this file).
 */
export const BEARER_TOKEN = '';
