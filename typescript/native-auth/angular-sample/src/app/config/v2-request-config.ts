import type { SignInInputsV2 } from "@azure/msal-browser/custom-auth";

export const v2AuthorizationInputs = {
    scopes: ["openid", "profile", "offline_access"],
    claims: JSON.stringify({
        access_token: {
            acrs: {
                values: ["c3"],
                essential: true,
            },
        },
    }),
} satisfies Pick<SignInInputsV2, "scopes" | "claims">;
