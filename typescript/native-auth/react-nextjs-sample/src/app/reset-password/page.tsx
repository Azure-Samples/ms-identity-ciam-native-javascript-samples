"use client";

import { useEffect, useState } from "react";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialForm } from "./components/InitialForm";
import { CodeForm } from "../shared/components/CodeForm";
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
    MfaAwaitingState,
    MfaVerificationRequiredState,
} from "@azure/msal-browser/custom-auth";
import { AuthMethodRegistrationForm } from "../shared/components/AuthMethodRegistrationForm";
import { AuthMethodRegistrationChallengeForm } from "../shared/components/AuthMethodRegistrationChallengeForm";
import { MfaAuthMethodSelectionForm } from "../shared/components/MfaAuthMethodSelectionForm";
import { MfaChallengeForm } from "../shared/components/MfaChallengeForm";

export default function ResetPassword() {
    const [app, setApp] = useState<ICustomAuthPublicClientApplication | null>(null);
    const [loadingAccountStatus, setLoadingAccountStatus] = useState(true);
    const [isSignedIn, setSignInState] = useState(false);
    const [username, setUsername] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resetState, setResetState] = useState<AuthFlowStateBase | null>(null);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [data, setData] = useState<CustomAuthAccountData | undefined>(undefined);

    // Auth method registration state
    const [authMethodsForRegistration, setAuthMethodsForRegistration] = useState<AuthenticationMethod[]>([]);
    const [selectedAuthMethodForRegistration, setSelectedAuthMethodForRegistration] = useState<
        AuthenticationMethod | undefined
    >(undefined);
    const [verificationContactForRegistration, setVerificationContactForRegistration] = useState("");
    const [challengeForRegistration, setChallengeForRegistration] = useState("");

    // MFA states
    const [mfaAuthMethods, setMfaAuthMethods] = useState<AuthenticationMethod[]>([]);
    const [selectedMfaAuthMethod, setSelectedMfaAuthMethod] = useState<AuthenticationMethod | undefined>(undefined);
    const [mfaChallenge, setMfaChallenge] = useState("");

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
            username,
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
                const methods = result.state.getAuthMethods();
                setAuthMethodsForRegistration(methods);
                setSelectedAuthMethodForRegistration(methods.length > 0 ? methods[0] : undefined);
                setResetState(state);
            } else if (result.isMfaRequired()) {
                const methods = result.state.getAuthMethods();
                setMfaAuthMethods(methods);
                setSelectedMfaAuthMethod(methods.length > 0 ? methods[0] : undefined);
                setResetState(state);
            } else if (result.isCompleted()) {
                setData(result.data);
                setResetState(state);
                setSignInState(true);
            }
        }
    };

    const handleAuthMethodRegistrationSubmit = async (e: React.FormEvent) => {
        if (!app) return;

        e.preventDefault();
        setError("");
        setLoading(true);

        if (!selectedAuthMethodForRegistration || !verificationContactForRegistration) {
            setError("Please select an authentication method and enter a verification contact.");
            setLoading(false);
            return;
        }

        if (resetState instanceof AuthMethodRegistrationRequiredState) {
            const result = await resetState.challengeAuthMethod({
                authMethodType: selectedAuthMethodForRegistration,
                verificationContact: verificationContactForRegistration,
            });

            if (result.isFailed()) {
                if (result.error?.isInvalidInput()) {
                    setError("Incorrect verification contact.");
                } else if (result.error?.isVerificationContactBlocked()) {
                    setError(
                        "The verification contact is blocked. Consider using a different contact or a different authentication method"
                    );
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

    const handleAuthMethodRegistrationChallengeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!challengeForRegistration) {
            setError("Please enter a code.");
            setLoading(false);
            return;
        }

        if (resetState instanceof AuthMethodVerificationRequiredState) {
            const result = await resetState.submitChallenge(challengeForRegistration);

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

    const handleMfaAuthMethodSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!selectedMfaAuthMethod) {
            setError("Please select an authentication method.");
            setLoading(false);
            return;
        }

        if (resetState instanceof MfaAwaitingState) {
            const result = await resetState.requestChallenge(selectedMfaAuthMethod.id);

            if (result.isFailed()) {
                if (result.error?.isInvalidInput()) {
                    setError("Incorrect verification contact.");
                } else {
                    setError(
                        result.error?.errorData?.errorDescription ||
                            "An error occurred while verifying the authentication method"
                    );
                }
            }

            if (result.isVerificationRequired()) {
                setResetState(result.state);
            }
        }

        setLoading(false);
    };

    const handleMfaChallengeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!mfaChallenge) {
            setError("Please enter a code.");
            setLoading(false);
            return;
        }

        if (resetState instanceof MfaVerificationRequiredState) {
            const result = await resetState.submitChallenge(mfaChallenge);

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
                setSignInState(true);
                setResetState(result.state);
            }
        }

        setLoading(false);
    };

    const getPlaceholderTextForVerificationContact = (): string => {
        if (!selectedAuthMethodForRegistration) {
            return "Enter your contact information";
        }

        const channel = selectedAuthMethodForRegistration.challenge_channel?.toLowerCase();
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
                <AuthMethodRegistrationForm
                    onSubmit={handleAuthMethodRegistrationSubmit}
                    authMethods={authMethodsForRegistration}
                    selectedAuthMethod={selectedAuthMethodForRegistration}
                    setSelectedAuthMethod={setSelectedAuthMethodForRegistration}
                    verificationContact={verificationContactForRegistration}
                    setVerificationContact={setVerificationContactForRegistration}
                    loading={loading}
                    getPlaceholderText={getPlaceholderTextForVerificationContact}
                    styles={styles}
                />
            );
        }

        if (resetState instanceof AuthMethodVerificationRequiredState) {
            return (
                <AuthMethodRegistrationChallengeForm
                    onSubmit={handleAuthMethodRegistrationChallengeSubmit}
                    challenge={challengeForRegistration}
                    setChallenge={setChallengeForRegistration}
                    loading={loading}
                    styles={styles}
                />
            );
        }

        if (resetState instanceof MfaAwaitingState) {
            return (
                <MfaAuthMethodSelectionForm
                    onSubmit={handleMfaAuthMethodSubmit}
                    authMethods={mfaAuthMethods}
                    selectedAuthMethod={selectedMfaAuthMethod}
                    setSelectedAuthMethod={setSelectedMfaAuthMethod}
                    loading={loading}
                    styles={styles}
                />
            );
        }

        if (resetState instanceof MfaVerificationRequiredState) {
            return (
                <MfaChallengeForm
                    onSubmit={handleMfaChallengeSubmit}
                    challenge={mfaChallenge}
                    setChallenge={setMfaChallenge}
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

        return <InitialForm onSubmit={handleInitialSubmit} username={username} setUsername={setUsername} loading={loading} />;
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Reset Password</h2>
            {renderForm()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
