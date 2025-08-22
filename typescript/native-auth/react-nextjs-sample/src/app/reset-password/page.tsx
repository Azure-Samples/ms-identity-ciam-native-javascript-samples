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
    AuthMethodRegistrationRequiredState,
    AuthMethodVerificationRequiredState,
    AuthenticationMethod,
} from "@azure/msal-browser/custom-auth";
import { AuthMethodForm } from "./components/AuthMethodForm";
import { ChallengeForm } from "./components/ChallengeForm";

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

    // Auth method registration state
    const [authMethods, setAuthMethods] = useState<AuthenticationMethod[]>([]);
    const [selectedAuthMethod, setSelectedAuthMethod] = useState<AuthenticationMethod | undefined>(undefined);
    const [verificationContact, setVerificationContact] = useState("");
    const [challenge, setChallenge] = useState("");

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
                    setError(
                        result.error?.errorData.errorDescription || "An error occurred while setting new password"
                    );
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

            if (result.isAuthMethodRegistrationRequired()) {
                // Set default selection to the first auth method
                const methods = result.state.getAuthMethods();
                setAuthMethods(methods);
                setSelectedAuthMethod(methods.length > 0 ? methods[0] : undefined);
                setResetState(state);
            } else if (result.isCompleted()) {
                setData(result.data);
                setResetState(state);
                setSignInState(true);
            }
        }
    };

    const handleAuthMethodSubmit = async (e: React.FormEvent) => {
        if (!app) return;

        e.preventDefault();
        setError("");
        setLoading(true);

        if (!selectedAuthMethod || !verificationContact) {
            setError("Please select an authentication method and enter a verification contact.");
            setLoading(false);
            return;
        }

        if (resetState instanceof AuthMethodRegistrationRequiredState) {
            const result = await resetState.challengeAuthMethod({
                authMethodType: selectedAuthMethod,
                verificationContact: verificationContact,
            });

            if (result.isFailed()) {
                if (result.error?.isIncorrectVerificationContact()) {
                    setError("Incorrect verification contact.");
                } else {
                    setError(
                        result.error?.errorData?.errorDescription ||
                            "An error occurred while verifying the authentication method"
                    );
                }
            }

            if (result.isCompleted()) {
                setData(result.data);
                setResetState(result.state);
                setSignInState(true);
            }

            if (result.isVerificationRequired()) {
                setResetState(result.state);
            }
        }

        setLoading(false);
    };

    const handleChallengeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!challenge) {
            setError("Please enter a code.");
            setLoading(false);
            return;
        }

        if (resetState instanceof AuthMethodVerificationRequiredState) {
            const result = await resetState.submitChallenge(challenge);

            if (result.isFailed()) {
                if (result.error?.isIncorrectChallenge()) {
                    setError("Incorrect code.");
                } else {
                    setError(
                        result.error?.errorData?.errorDescription ||
                            "An error occurred while verifying the challenge response"
                    );
                }
            }

            if (result.isCompleted()) {
                setData(result.data);
                setResetState(result.state);
                setSignInState(true);
            }
        }

        setLoading(false);
    };

    const getPlaceholderText = (): string => {
        if (!selectedAuthMethod) {
            return "Enter your contact information";
        }

        const channel = selectedAuthMethod.challenge_channel?.toLowerCase();
        if (channel === "email") {
            return "Enter your email for verification";
        } else if (channel === "sms" || channel === "phone") {
            return "Enter your phone number for verification";
        } else {
            return "Enter your contact information for verification";
        }
    };

    const renderForm = () => {
        if (loadingAccountStatus) {
            return;
        }

        if (isSignedIn) {
            return <div style={styles.signed_in_msg}>Please sign out before processing the password reset.</div>;
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
            return (
                <CodeForm
                    onSubmit={handleCodeSubmit}
                    code={code}
                    setCode={setCode}
                    loading={loading}
                    onResendCode={handleResendCode}
                    resendCountdown={resendCountdown}
                />
            );
        }

        if (resetState instanceof AuthMethodRegistrationRequiredState) {
            return (
                <AuthMethodForm
                    onSubmit={handleAuthMethodSubmit}
                    authMethods={authMethods}
                    selectedAuthMethod={selectedAuthMethod}
                    setSelectedAuthMethod={setSelectedAuthMethod}
                    verificationContact={verificationContact}
                    setVerificationContact={setVerificationContact}
                    loading={loading}
                    getPlaceholderText={getPlaceholderText}
                    styles={styles}
                />
            );
        }

        if (resetState instanceof AuthMethodVerificationRequiredState) {
            return (
                <ChallengeForm
                    onSubmit={handleChallengeSubmit}
                    challenge={challenge}
                    setChallenge={setChallenge}
                    loading={loading}
                    styles={styles}
                />
            );
        }

        if (resetState instanceof ResetPasswordCompletedState) {
            return <div style={styles.signed_in_msg}>Password reset completed! Signing you in automatically...</div>;
        }

        if (resetState instanceof SignInCompletedState) {
            return (
                <div style={styles.signed_in_msg}>
                    Sign up completed! Automatically sign in as {data?.getAccount().username}.
                </div>
            );
        }

        return <InitialForm onSubmit={handleInitialSubmit} email={email} setEmail={setEmail} loading={loading} />;
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Reset Password</h2>
            {renderForm()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
