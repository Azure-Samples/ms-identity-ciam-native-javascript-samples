"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { PopupRequest } from "@azure/msal-browser";
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
import {
    type CustomAuthAccountData,
} from "@azure/msal-browser/custom-auth";
import { useAuth } from "./auth/AuthProvider";
import { AuthStartForm } from "./auth/components/forms/AuthStartForm";
import type { ActiveFlow, AuthFlowProps, AuthStartRequest, AuthVersion } from "./auth/types";
import { startV1AuthFlow, V1AuthEntryFlow } from "./auth/v1/V1AuthEntryFlow";
import { startV2AuthFlow, V2AuthEntryFlow } from "./auth/v2/V2AuthEntryFlow";
import { UserInfo } from "./auth/components/account/UserInfo";
import { customAuthConfig } from "../config/auth-config";

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected authentication error occurred.";
}

export default function Home() {
    const { app, account, error, loading, setAccount, setError, setLoading } = useAuth();
    const [version, setVersion] = useState<AuthVersion>("v2");
    const [username, setUsername] = useState("");
    const [activeFlow, setActiveFlow] = useState<ActiveFlow>();

    useEffect(() => {
        const params = `${window.location.hash}${window.location.search}`;
        if (/[#&?](code|error|ear_jwe)=/.test(params)) {
            broadcastResponseToMainFrame().catch((caughtError: unknown) => {
                setError(getThrownErrorMessage(caughtError));
            });
        }
    }, [setError]);

    useLayoutEffect(() => {
        if (!account) {
            setUsername("");
        }
    }, [account]);

    const cancelFlow = useCallback(() => {
        setActiveFlow(undefined);
        setUsername("");
        setError("");
    }, [setError]);

    const completeFlow = useCallback((authenticatedAccount?: CustomAuthAccountData) => {
        setActiveFlow(undefined);
        setError("");
        setLoading(false);
        if (authenticatedAccount) {
            setAccount(authenticatedAccount);
        }
    }, [setAccount, setError, setLoading]);

    const startAuthFlow = async ({ action, username: submittedUsername, password }: AuthStartRequest) => {
        const normalizedUsername = submittedUsername.trim();
        if (!normalizedUsername) {
            setError("Enter an email address.");
            return;
        }

        if (!app) {
            setError("The authentication client is not ready.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const credentials = {
                username: normalizedUsername,
                ...(password ? { password } : {}),
            };
            const flow =
                version === "v1"
                    ? await startV1AuthFlow(app, action, credentials)
                    : await startV2AuthFlow(app, action, credentials);

            setActiveFlow(flow);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const changeVersion = (nextVersion: AuthVersion) => {
        setActiveFlow(undefined);
        setError("");
        setVersion(nextVersion);
    };

    const continueWithProvider = async (domainHint: string) => {
        if (!app) {
            setError("The authentication client is not ready.");
            return;
        }

        setError("");
        setLoading(true);
        const popupRequest: PopupRequest = {
            authority: customAuthConfig.auth.authority,
            scopes: [],
            redirectUri: customAuthConfig.auth.redirectUri || "",
            prompt: "login",
            domainHint,
        };

        try {
            await app.loginPopup(popupRequest);
            const accountResult = app.getCurrentAccount();
            if (accountResult.isFailed()) {
                setError(
                    accountResult.error?.errorData.errorDescription ||
                        "An error occurred while getting the account from the cache.",
                );
            }
            if (accountResult.isCompleted()) {
                completeFlow(accountResult.data);
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    if (!app) {
        return (
            <main>
                <div className="auth-container">
                    <h1 className="auth-heading">Native Authentication</h1>
                    <p>{loading ? "Initializing authentication..." : error || "Authentication could not be initialized."}</p>
                </div>
            </main>
        );
    }

    if (account) {
        return (
            <main>
                <div className="auth-container">
                    <h1 className="auth-heading">Native Authentication</h1>
                    {error && <p className="auth-error">{error}</p>}
                    <UserInfo userData={account} />
                </div>
            </main>
        );
    }

    if (activeFlow) {
        const flowProps: AuthFlowProps = {
            ...activeFlow,
            app,
            onCancel: cancelFlow,
            onCompleted: completeFlow,
        };

        return (
            <main>
                {flowProps.version === "v1" ? (
                    <V1AuthEntryFlow {...flowProps} />
                ) : (
                    <V2AuthEntryFlow {...flowProps} />
                )}
            </main>
        );
    }

    return (
        <main>
            <div className="auth-container">
                <h1 className="auth-heading">Native Authentication</h1>
                <AuthStartForm
                    version={version}
                    username={username}
                    error={error}
                    loading={loading}
                    onVersionChange={changeVersion}
                    onUsernameChange={setUsername}
                    onStart={startAuthFlow}
                    onSocialSelect={continueWithProvider}
                />
            </div>
        </main>
    );
}
