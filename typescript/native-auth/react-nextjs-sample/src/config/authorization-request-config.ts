import type { SignInInputs } from "@azure/msal-browser/custom-auth";

export const authorizationInputs = {
    scopes: ["openid", "profile", "offline_access"],
    claims: JSON.stringify({
        access_token: {
            acrs: {
                values: ["c4"],
                essential: true,
            },
        },
    }),
} satisfies Pick<SignInInputs, "scopes" | "claims">;
