"use client";

import { useState } from "react";
import type { CustomAuthAccountData } from "@azure/msal-browser/custom-auth";

interface ForceRefreshTokenProps {
    accountData: CustomAuthAccountData;
}

export function ForceRefreshToken({ accountData }: ForceRefreshTokenProps) {
    const [scope, setScope] = useState("");
    const [claims, setClaims] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    const handleForceRefresh = async () => {
        setStatus("");
        setError("");

        const requestedScope = scope.trim();

        setLoading(true);

        try {
            const requestedClaims = claims.trim();
            const result = await accountData.getAccessToken({
                forceRefresh: true,
                ...(requestedScope && { scopes: [requestedScope] }),
                ...(requestedClaims && { claims: requestedClaims }),
            });
            const errorDescription = result.error?.errorData.errorDescription;

            if (result.isCompleted()) {
                const expiresOn = result.data?.expiresOn;
                setStatus(
                    expiresOn
                        ? `Force refresh succeeded. Token expires ${expiresOn.toLocaleString()}.`
                        : "Force refresh succeeded.",
                );
                return;
            }

            setError(errorDescription || "Force refresh failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ marginTop: "15px" }}>
            <div
                style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                }}
            >
                <input
                    type="text"
                    value={scope}
                    onChange={(event) => setScope(event.target.value)}
                    placeholder="Scope, e.g. User.Read"
                    disabled={loading}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "16px",
                    }}
                />
                <button
                    type="button"
                    onClick={handleForceRefresh}
                    disabled={loading}
                    style={{
                        padding: "10px",
                        backgroundColor: loading ? "#6b7280" : "#0078d4",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontSize: "16px",
                        whiteSpace: "nowrap",
                    }}
                >
                    {loading ? "Force refreshing..." : "Force Refresh Token"}
                </button>
            </div>
            <textarea
                value={claims}
                onChange={(event) => setClaims(event.target.value)}
                placeholder={
                    'Optional refresh-only claims JSON, e.g. {"access_token":{"acrs":{"essential":true,"value":"c4"}}}'
                }
                disabled={loading}
                rows={3}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "10px",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                    resize: "vertical",
                }}
            />
            {status && <div style={{ color: "#107c10", marginTop: "10px" }}>{status}</div>}
            {error && <div style={{ color: "#d13438", marginTop: "10px" }}>{error}</div>}
        </div>
    );
}
