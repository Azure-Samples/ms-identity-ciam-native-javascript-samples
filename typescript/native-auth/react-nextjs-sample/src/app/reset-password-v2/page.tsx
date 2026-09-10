"use client";

import { useEffect, useState } from "react";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "../reset-password/styles/styles";
import { InitialForm } from "../reset-password/components/InitialForm";
import { NewPasswordForm } from "../reset-password/components/NewPasswordForm";
import { MethodSelectionFormV2 } from "../shared/v2/components/MethodSelectionFormV2";
import { ChallengeFormV2 } from "../shared/v2/components/ChallengeFormV2";
import { ForceRefreshToken } from "../shared/components/ForceRefreshToken";
import {
    CustomAuthPublicClientApplication,
    ICustomAuthPublicClientApplicationV2,
    AuthFlowStateBase,
    CustomAuthAccountData,
    AuthMethodSelectionRequiredStateV2,
    CodeRequiredStateV2,
    NewPasswordRequiredStateV2,
    SignInContinuationStateV2,
    CompletedStateV2,
} from "@azure/msal-browser/custom-auth";
import type { AuthenticationMethodV2 } from "@azure/msal-browser/custom-auth";

export default function ResetPasswordV2() {
    const [app, setApp] = useState<ICustomAuthPublicClientApplicationV2 | null>(null);
    const [loadingAccountStatus, setLoadingAccountStatus] = useState(true);
    const [isSignedIn, setSignInState] = useState(false);
    const [username, setUsername] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resetState, setResetState] = useState<AuthFlowStateBase | null>(null);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [data, setData] = useState<CustomAuthAccountData | undefined>(undefined);

    useEffect(() => {
        const initializeApp = async () => {
            const appInstance = await CustomAuthPublicClientApplication.create(customAuthConfig);
            setApp(appInstance);
        };

        initializeApp();
    }, []);

    useEffect(() => {
        const checkAccount = async () => {
            if (!app) return;

            const accountResult = app.getCurrentAccount();

            if (accountResult.isCompleted()) {
                setSignInState(true);
            }

            setLoadingAccountStatus(false);
        };

        checkAccount();
    }, [app]);

    useEffect(() => {
        if (resendCountdown <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setResendCountdown((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCountdown]);

    const handleMethodSubmit = async (method: AuthenticationMethodV2) => {
        if (!(resetState instanceof AuthMethodSelectionRequiredStateV2)) {
            return;
        }

        setError("");
        setLoading(true);

        const result = await resetState.requestChallenge(method);

        if (result.isFailed()) {
            if (result.error?.isInvalidInput()) {
                setError("Please select an authentication method offered by the service.");
            } else if (result.error?.isBrowserRequired()) {
                setError("This authentication method must be completed in a browser.");
            } else {
                setError(result.error?.errorDescription || "An error occurred while requesting the verification code");
            }
        } else {
            setResetState(result.state);
        }

        setLoading(false);
    };

    const handleInitialSubmit = async (e: React.FormEvent) => {
        if (!app) return;

        e.preventDefault();
        setError("");
        setLoading(true);

        const result = await app.resetPasswordV2({ username });

        if (result.isFailed()) {
            if (result.error?.isInvalidInput()) {
                setError("Enter a valid username.");
            } else if (result.error?.isInvalidUsername()) {
                setError("The username is invalid.");
            } else if (result.error?.isUserNotFound()) {
                setError("User not found.");
            } else if (result.error?.isBrowserRequired()) {
                setError("Password reset must be completed in a browser.");
            } else {
                setError(result.error?.errorDescription || "An error occurred while initiating password reset");
            }
        } else {
            setResetState(result.state);
        }

        setLoading(false);
    };

    const handleResendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setResendLoading(true);

        try {
            if (!(resetState instanceof CodeRequiredStateV2)) {
                return;
            }

            const result = await resetState.resendCode();
            if (result.isFailed()) {
                if (result.error?.isBrowserRequired()) {
                    setError("Resending the code requires continuing in a browser.");
                } else {
                    setError(result.error?.errorDescription || "An error occurred while resending the code");
                }
            } else {
                setResetState(result.state);
                setCode("");
                setResendCountdown(30);
            }
        } finally {
            setResendLoading(false);
        }
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (resetState instanceof CodeRequiredStateV2) {
            const result = await resetState.submitCode(code);

            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    setError("The verification code is invalid or expired.");
                } else if (result.error?.isInvalidInput()) {
                    setError("Enter the complete verification code.");
                } else if (result.error?.isBrowserRequired()) {
                    setError("Code verification must be completed in a browser.");
                } else {
                    setError(result.error?.errorDescription || "An error occurred while verifying the code");
                }
            } else {
                setResetState(result.state);
            }
        }

        setLoading(false);
    };

    const handleNewPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (resetState instanceof NewPasswordRequiredStateV2) {
            const result = await resetState.submitNewPassword(newPassword);

            if (result.isFailed()) {
                if (result.error?.isInvalidPassword()) {
                    setError("The new password does not meet the password requirements.");
                } else if (result.error?.isInvalidInput()) {
                    setError("Enter a new password.");
                } else if (result.error?.isBrowserRequired()) {
                    setError("Password reset must be completed in a browser.");
                } else {
                    setError(result.error?.errorDescription || "An error occurred while setting the new password");
                }
            } else if (result.state instanceof SignInContinuationStateV2) {
                setResetState(result.state);
                await handleAutoSignIn(result.state);
            } else {
                setError("Password reset returned an unsupported state.");
            }
        }

        setLoading(false);
    };

    const handleAutoSignIn = async (signInState: SignInContinuationStateV2) => {
        setError("");

        const result = await signInState.signIn({
            scopes: [],
        });

        if (result.isFailed()) {
            if (result.error?.isBrowserRequired()) {
                setError("Sign-in must be completed in a browser.");
            } else {
                setError(result.error?.errorDescription || "Password reset completed, but automatic sign-in failed.");
            }
        } else if (result.isState("completed")) {
            setData(result.data);
            setResetState(result.state);
            setSignInState(true);
        } else {
            setError("Sign-in after password reset returned an unsupported state.");
        }
    };

    const renderForm = () => {
        if (loadingAccountStatus) {
            return;
        }

        if (isSignedIn && !(resetState instanceof CompletedStateV2)) {
            return <div style={styles.signed_in_msg}>Please sign out before processing the password reset.</div>;
        }

        if (resetState instanceof AuthMethodSelectionRequiredStateV2) {
            return (
                <MethodSelectionFormV2 methods={resetState.methods} onSubmit={handleMethodSubmit} loading={loading} />
            );
        }

        if (resetState instanceof NewPasswordRequiredStateV2) {
            return (
                <NewPasswordForm
                    onSubmit={handleNewPasswordSubmit}
                    newPassword={newPassword}
                    setNewPassword={setNewPassword}
                    loading={loading}
                />
            );
        }

        if (resetState instanceof CodeRequiredStateV2) {
            return (
                <ChallengeFormV2
                    onSubmit={handleCodeSubmit}
                    code={code}
                    setCode={setCode}
                    loading={loading}
                    onResendCode={handleResendCode}
                    resendCountdown={resendCountdown}
                    resendLoading={resendLoading}
                    sentTo={resetState.sentTo}
                    channel={resetState.channel}
                    codeLength={resetState.codeLength}
                />
            );
        }

        if (resetState instanceof CompletedStateV2) {
            return (
                <>
                    <div style={styles.signed_in_msg}>
                        Password reset completed! Signed in as {data?.getAccount().username}.
                    </div>
                    {data && <ForceRefreshToken accountData={data} />}
                </>
            );
        }

        return (
            <InitialForm
                onSubmit={handleInitialSubmit}
                username={username}
                setUsername={setUsername}
                loading={loading}
            />
        );
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Reset Password (V2)</h2>
            {renderForm()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
