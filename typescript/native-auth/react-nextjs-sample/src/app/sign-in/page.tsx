"use client";

import { useEffect, useState } from "react";
import {
    AuthFlowStateBase,
    CustomAuthAccountData,
    CustomAuthPublicClientApplication,
    ICustomAuthPublicClientApplication,
    SignInCompletedState,
    AuthMethodRegistrationRequiredState,
    AuthMethodVerificationRequiredState,
    AuthenticationMethod,
} from "@azure/msal-browser/custom-auth";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialForm } from "./components/InitialForm";
import { PasswordForm } from "./components/PasswordForm";
import { CodeForm } from "./components/CodeForm";
import { AuthMethodForm } from "./components/AuthMethodForm";
import { ChallengeForm } from "./components/ChallengeForm";
import { SignInCodeRequiredState, SignInPasswordRequiredState } from "@azure/msal-browser/custom-auth";
import { PopupRequest } from "@azure/msal-browser";
import { UserInfo } from "./components/UserInfo";

export default function SignIn() {
    const [authClient, setAuthClient] = useState<ICustomAuthPublicClientApplication | null>(null);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [signInState, setSignInState] = useState<AuthFlowStateBase | null>(null);
    const [data, setData] = useState<CustomAuthAccountData | undefined>(undefined);
    const [loadingAccountStatus, setLoadingAccountStatus] = useState(true);
    const [isSignedIn, setCurrentSignInStatus] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);

    // Auth method registration states
    const [authMethods, setAuthMethods] = useState<AuthenticationMethod[]>([]);
    const [selectedAuthMethod, setSelectedAuthMethod] = useState<AuthenticationMethod | undefined>(undefined);
    const [verificationContact, setVerificationContact] = useState("");
    const [challenge, setChallenge] = useState("");

    useEffect(() => {
        const initializeApp = async () => {
            const appInstance = await CustomAuthPublicClientApplication.create(customAuthConfig);
            setAuthClient(appInstance);
        };

        initializeApp();
    }, []);

    useEffect(() => {
        const checkAccount = async () => {
            if (!authClient) return;

            const accountResult = authClient.getCurrentAccount();

            if (accountResult.isCompleted()) {
                setCurrentSignInStatus(true);
            }

            setData(accountResult.data);

            setLoadingAccountStatus(false);
        };

        checkAccount();
    }, [authClient]);

    const startSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!authClient) return;

        // Start the sign-in flow
        const result = await authClient.signIn({
            username,
        });

        // Thge result may have the different states,
        // such as Password required state, OTP code rquired state, Failed state and Completed state.

        if (result.isFailed()) {
            if (result.error?.isUserNotFound()) {
                setError("User not found");
            } else if (result.error?.isInvalidUsername()) {
                setError("Username is invalid");
            } else if (result.error?.isPasswordIncorrect()) {
                setError("Password is invalid");
            } else if (result.error?.isRedirectRequired()) {
                // Fallback to the delegated authentication flow.
                const popUpRequest: PopupRequest = {
                    authority: customAuthConfig.auth.authority,
                    scopes: [],
                    redirectUri: customAuthConfig.auth.redirectUri || "",
                    prompt: "login", // Forces the user to enter their credentials on that request, negating single-sign on.
                };

                try {
                    await authClient.loginPopup(popUpRequest);

                    const accountResult = authClient.getCurrentAccount();

                    if (accountResult.isFailed()) {
                        setError(
                            accountResult.error?.errorData?.errorDescription ??
                                "An error occurred while getting the account from cache"
                        );
                    }

                    if (accountResult.isCompleted()) {
                        result.state = new SignInCompletedState();
                        result.data = accountResult.data;
                    }
                } catch (error) {
                    if (error instanceof Error) {
                        setError(error.message);
                    } else {
                        setError("An unexpected error occurred while logging in with popup");
                    }
                }
            } else {
                setError(`An error occurred: ${result.error?.errorData?.errorDescription}`);
            }
        }

        if (result.isCompleted()) {
            setData(result.data);
            setCurrentSignInStatus(true);
        }

        // Check for auth method registration requirement
        if (result.isAuthMethodRegistrationRequired()) {
            setAuthMethods(result.state.getAuthMethods());
            // Set default selection to the first auth method
            const methods = result.state.getAuthMethods();
            setSelectedAuthMethod(methods.length > 0 ? methods[0] : undefined);
        }

        setSignInState(result.state);

        setLoading(false);
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (signInState instanceof SignInPasswordRequiredState) {
            const result = await signInState.submitPassword(password);

            if (result.isFailed()) {
                if (result.error?.isInvalidPassword()) {
                    setError("Incorrect password");
                } else {
                    setError(
                        result.error?.errorData?.errorDescription || "An error occurred while verifying the password"
                    );
                }
            }

            if (result.isCompleted()) {
                setData(result.data);
                setCurrentSignInStatus(true);
                setSignInState(result.state);
            }

            // Check for auth method registration requirement
            if (result.isAuthMethodRegistrationRequired()) {
                setAuthMethods(result.state.getAuthMethods());
                // Set default selection to the first auth method
                const methods = result.state.getAuthMethods();
                setSelectedAuthMethod(methods.length > 0 ? methods[0] : undefined);
                setSignInState(result.state);
            }
        }

        setLoading(false);
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (signInState instanceof SignInCodeRequiredState) {
            const result = await signInState.submitCode(code);

            // the result object may have the different states, such as Failed state and Completed state.

            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    setError("Invalid code");
                } else {
                    setError(result.error?.errorData?.errorDescription || "An error occurred while verifying the code");
                }
            }

            if (result.isCompleted()) {
                setData(result.data);
                setSignInState(result.state);
            }
        }

        setLoading(false);
    };

    const handleResendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(false);

        if (signInState instanceof SignInCodeRequiredState) {
            const result = await signInState.resendCode();
            const state = result.state;

            if (result.isFailed()) {
                setError(result.error?.errorData?.errorDescription || "An error occurred while resending the code");
            } else {
                setSignInState(state);
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

        setLoading(false);
    };

    const handleAuthMethodSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!selectedAuthMethod || !verificationContact) {
            setError("Please select an authentication method and enter a verification contact.");
            setLoading(false);
            return;
        }

        if (signInState instanceof AuthMethodRegistrationRequiredState) {
            const result = await signInState.challengeAuthMethod({
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
                setCurrentSignInStatus(true);
                setSignInState(result.state);
            }

            if (result.isVerificationRequired()) {
                setSignInState(result.state);
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

        if (signInState instanceof AuthMethodVerificationRequiredState) {
            const result = await signInState.submitChallenge(challenge);

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
                setCurrentSignInStatus(true);
                setSignInState(result.state);
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

        if (isSignedIn || signInState instanceof SignInCompletedState) {
            return <UserInfo userData={data} />;
        }

        if (signInState instanceof SignInPasswordRequiredState) {
            return (
                <PasswordForm
                    onSubmit={handlePasswordSubmit}
                    password={password}
                    setPassword={setPassword}
                    loading={loading}
                />
            );
        }

        if (signInState instanceof SignInCodeRequiredState) {
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

        if (signInState instanceof AuthMethodRegistrationRequiredState) {
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

        if (signInState instanceof AuthMethodVerificationRequiredState) {
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

        return <InitialForm onSubmit={startSignIn} username={username} setUsername={setUsername} loading={loading} />;
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Sign In</h2>
            <>
                {renderForm()}
                {error && <div style={styles.error}>{error}</div>}
            </>
        </div>
    );
}
