"use client";

import { useEffect, useState } from "react";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialForm } from "./components/InitialForm";
import { CodeForm } from "./components/CodeForm";
import { NewPasswordForm } from "./components/NewPasswordForm";
import {
    CustomAuthPublicClientApplication,
    ICustomAuthPublicClientApplication,
    ResetPasswordCodeRequiredState,
    ResetPasswordPasswordRequiredState,
    ResetPasswordCompletedState,
    AuthFlowStateBase,
    CustomAuthAccountData,
    SignInCompletedState,
} from "@azure/msal-browser/custom-auth";
import { UserInfo } from "../sign-in/components/UserInfo";

export default function ResetPassword() {
    const [app, setApp] = useState<ICustomAuthPublicClientApplication | null>(null);
    const [loadingAccountStatus, setLoadingAccountStatus] = useState(true);
    const [isSignedIn, setSignInState] = useState(false);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
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

    const handleInitialSubmit = async (e: React.FormEvent) => {
        if (!app) return;

        e.preventDefault();
        setError("");
        setLoading(true);

        const result = await app.resetPassword({
            username: email,
        });

        const state = result.state;

        if (result.isFailed()) {
            if (result.error?.isInvalidUsername()) {
                setError("Invalid email address");
            } else if (result.error?.isUserNotFound()) {
                setError("User not found");
            } else {
                setError(
                    result.error?.errorData.errorDescription || "An error occurred while initiating password reset"
                );
            }
        } else {
            setResetState(state);
        }

        setLoading(false);
    };

    const handleResendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(false);

        if (resetState instanceof ResetPasswordCodeRequiredState) {
            const result = await resetState.resendCode();
            const state = result.state;

            if (result.isFailed()) {
                setError(result.error?.errorData.errorDescription || "An error occurred while resending the code");
            } else {
                setResetState(state);
                setResendCountdown(30);
                
                const timer = setInterval(() => {
                    setResendCountdown((prev) => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }
        }
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (resetState instanceof ResetPasswordCodeRequiredState) {
            const result = await resetState.submitCode(code);
            const state = result.state;

            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    setError("Invalid verification code");
                } else {
                    setError(result.error?.errorData.errorDescription || "An error occurred while verifying the code");
                }
            } else {
                setResetState(state);
            }
        }

        setLoading(false);
    };

    const handleNewPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (resetState instanceof ResetPasswordPasswordRequiredState) {
            const result = await resetState.submitNewPassword(newPassword);
            const state = result.state;

            if (result.isFailed()) {
                if (result.error?.isInvalidPassword()) {
                    setError("Invalid password");
                } else {
                    setError(result.error?.errorData.errorDescription || "An error occurred while setting new password");
                }
            } else {
                setResetState(state);

                if (state instanceof ResetPasswordCompletedState) {
                    await handleAutoSignIn(state);
                }
            }
        }

        setLoading(false);
    };

    const handleAutoSignIn = async (resetState: ResetPasswordCompletedState) => {
        setError("");

        if (resetState instanceof ResetPasswordCompletedState) {
            const result = await resetState.signIn();
            const state = result.state;

            if (result.isFailed()) {
                setError(result.error?.errorData?.errorDescription || "An error occurred during auto sign-in");
            }
            if (result.isCompleted()) {
                setData(result.data);
                setResetState(state);
            }
        }
    };

    const renderForm = () => {
        if (loadingAccountStatus) {
            return;
        }

        if (isSignedIn) {
            return (
                <div style={styles.signed_in_msg}>Please sign out before processing the password reset.</div>
            );
        }

        if (resetState instanceof ResetPasswordPasswordRequiredState) {
            return (
                <NewPasswordForm
                    onSubmit={handleNewPasswordSubmit}
                    newPassword={newPassword}
                    setNewPassword={setNewPassword}
                    loading={loading}
                />
            );
        }

        if (resetState instanceof ResetPasswordCodeRequiredState) {
            return <CodeForm onSubmit={handleCodeSubmit} code={code} setCode={setCode} loading={loading} onResendCode={handleResendCode} resendCountdown={resendCountdown} />;
        }

        if (resetState instanceof ResetPasswordCompletedState) {
            return <div style={styles.signed_in_msg}>Password reset completed! Signing you in automatically...</div>;
        }

        if (resetState instanceof SignInCompletedState) {
            return <div style={styles.signed_in_msg}>Sign up completed! Sign in automatically complete.</div>;
        }

        return (
            <InitialForm
                onSubmit={handleInitialSubmit}
                email={email}
                setEmail={setEmail}
                loading={loading}
            />
        );
    }

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Reset Password</h2>
            {renderForm()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
