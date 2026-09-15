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
import { getV2ErrorMessage } from "../shared/v2/utils/getV2ErrorMessage";

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
                setError(getV2ErrorMessage(result.error));
            } else if (result.error?.isBrowserRequired()) {
                setError(getV2ErrorMessage(result.error));
            } else {
                setError(getV2ErrorMessage(result.error));
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
                setError(getV2ErrorMessage(result.error));
            } else if (result.error?.isInvalidUsername()) {
                setError(getV2ErrorMessage(result.error));
            } else if (result.error?.isUserNotFound()) {
                setError(getV2ErrorMessage(result.error));
            } else if (result.error?.isBrowserRequired()) {
                setError(getV2ErrorMessage(result.error));
            } else {
                setError(getV2ErrorMessage(result.error));
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
                    setError(getV2ErrorMessage(result.error));
                } else {
                    setError(getV2ErrorMessage(result.error));
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
                    setError(getV2ErrorMessage(result.error));
                } else if (result.error?.isInvalidInput()) {
                    setError(getV2ErrorMessage(result.error));
                } else if (result.error?.isBrowserRequired()) {
                    setError(getV2ErrorMessage(result.error));
                } else {
                    setError(getV2ErrorMessage(result.error));
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
                    setError(getV2ErrorMessage(result.error));
                } else if (result.error?.isInvalidInput()) {
                    setError(getV2ErrorMessage(result.error));
                } else if (result.error?.isBrowserRequired()) {
                    setError(getV2ErrorMessage(result.error));
                } else {
                    setError(getV2ErrorMessage(result.error));
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

        const result = await signInState.signIn();

        if (result.isFailed()) {
            if (result.error?.isBrowserRequired()) {
                setError(getV2ErrorMessage(result.error));
            } else {
                setError(getV2ErrorMessage(result.error));
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
                    noValidate
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
                    noValidate
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
                noValidate
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
