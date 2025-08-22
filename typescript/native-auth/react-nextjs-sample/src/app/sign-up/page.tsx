"use client";

import { useEffect, useState } from "react";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialForm } from "./components/InitialForm";
import {
    AuthFlowStateBase,
    CustomAuthAccountData,
    CustomAuthPublicClientApplication,
    ICustomAuthPublicClientApplication,
    SignInCompletedState,
    SignUpCodeRequiredState,
    SignUpCompletedState,
    SignUpPasswordRequiredState,
    UserAccountAttributes,
    AuthMethodRegistrationRequiredState,
    AuthMethodVerificationRequiredState,
    AuthenticationMethod,
} from "@azure/msal-browser/custom-auth";
import { CodeForm } from "./components/CodeForm";
import { PasswordForm } from "./components/PasswordForm";
import { AuthMethodForm } from "./components/AuthMethodForm";
import { ChallengeForm } from "./components/ChallengeForm";

export default function SignUpPassword() {
    const [authClient, setAuthClient] = useState<ICustomAuthPublicClientApplication | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [signUpState, setSignUpState] = useState<AuthFlowStateBase | null>(null);
    const [loadingAccountStatus, setLoadingAccountStatus] = useState(true);
    const [isSignedIn, setSignInState] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [data, setData] = useState<CustomAuthAccountData | undefined>(undefined);

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
                setSignInState(true);
            }

            setLoadingAccountStatus(false);
        };

        checkAccount();
    }, [authClient]);

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!authClient) return;

        const attributes: UserAccountAttributes = {
            displayName: `${firstName} ${lastName}`,
            givenName: firstName,
            surname: lastName,
            jobTitle: jobTitle,
            city: city,
            country: country,
        };

        const result = await authClient.signUp({
            username: email,
            attributes,
        });
        const state = result.state;

        if (result.isFailed()) {
            if (result.error?.isUserAlreadyExists()) {
                setError("An account with this email already exists");
            } else if (result.error?.isInvalidUsername()) {
                setError("Invalid uername");
            } else if (result.error?.isInvalidPassword()) {
                setError("Invalid password");
            } else if (result.error?.isAttributesValidationFailed()) {
                setError("Invalid attributes");
            } else if (result.error?.isMissingRequiredAttributes()) {
                setError("Missing required attributes");
            } else {
                setError(result.error?.errorData.errorDescription || "An error occurred while signing up");
            }
        } else {
            setSignUpState(state);
        }

        setLoading(false);
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (signUpState instanceof SignUpCodeRequiredState) {
            const result = await signUpState.submitCode(code);
            const state = result.state;

            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    setError("Invalid verification code");
                } else {
                    setError(result.error?.errorData.errorDescription || "An error occurred while verifying the code");
                }
            } else {
                setSignUpState(state);

                if (state instanceof SignUpCompletedState) {
                    await handleAutoSignIn(state);
                }
            }
        }

        setLoading(false);
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (signUpState instanceof SignUpPasswordRequiredState) {
            const result = await signUpState.submitPassword(password);
            const state = result.state;

            if (result.isFailed()) {
                if (result.error?.isInvalidPassword()) {
                    setError("Invalid password");
                } else {
                    setError(
                        result.error?.errorData.errorDescription || "An error occurred while submitting the password"
                    );
                }
            } else {
                setSignUpState(state);

                if (state instanceof SignUpCompletedState) {
                    await handleAutoSignIn(state);
                }
            }
        }

        setLoading(false);
    };

    const handleResendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(false);

        if (signUpState instanceof SignUpCodeRequiredState) {
            const result = await signUpState.resendCode();
            const state = result.state;

            if (result.isFailed()) {
                setError(result.error?.errorData.errorDescription || "An error occurred while resending the code");
            } else {
                setSignUpState(state);
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

    const handleAutoSignIn = async (signUpState: SignUpCompletedState) => {
        setError("");

        if (signUpState instanceof SignUpCompletedState) {
            const result = await signUpState.signIn();
            const state = result.state;

            if (result.isFailed()) {
                setError(result.error?.errorData?.errorDescription || "An error occurred during auto sign-in");
            }

            // Check for auth method registration requirement
            if (result.isAuthMethodRegistrationRequired()) {
                setAuthMethods(result.state.getAuthMethods());
                // Set default selection to the first auth method
                const methods = result.state.getAuthMethods();
                setSelectedAuthMethod(methods.length > 0 ? methods[0] : undefined);
                setSignUpState(result.state);
            } else if (result.isCompleted()) {
                setData(result.data);
                setSignUpState(state);
                setSignInState(true);
            }
        }
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

        if (signUpState instanceof AuthMethodRegistrationRequiredState) {
            const result = await signUpState.challengeAuthMethod({
                authMethodType: selectedAuthMethod,
                verificationContact: verificationContact,
            });

            if (result.isFailed()) {
                if (result.error?.isIncorrectVerificationContact && result.error.isIncorrectVerificationContact()) {
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
                setSignUpState(result.state);
                setSignInState(true);
            }

            if (result.isVerificationRequired && result.isVerificationRequired()) {
                setSignUpState(result.state);
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

        if (signUpState instanceof AuthMethodVerificationRequiredState) {
            const result = await signUpState.submitChallenge(challenge);

            if (result.isFailed()) {
                if (result.error?.isIncorrectChallenge && result.error.isIncorrectChallenge()) {
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
                setSignUpState(result.state);
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
            return <div style={styles.signed_in_msg}>Please sign out before processing the sign up.</div>;
        }

        if (signUpState instanceof SignUpCodeRequiredState) {
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
        } else if (signUpState instanceof SignUpPasswordRequiredState) {
            return (
                <PasswordForm
                    onSubmit={handlePasswordSubmit}
                    password={password}
                    setPassword={setPassword}
                    loading={loading}
                />
            );
        } else if (signUpState instanceof SignUpCompletedState) {
            return <div style={styles.signed_in_msg}>Sign up completed! Signing you in automatically...</div>;
        } else if (signUpState instanceof AuthMethodRegistrationRequiredState) {
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
        } else if (signUpState instanceof AuthMethodVerificationRequiredState) {
            return (
                <ChallengeForm
                    onSubmit={handleChallengeSubmit}
                    challenge={challenge}
                    setChallenge={setChallenge}
                    loading={loading}
                    styles={styles}
                />
            );
        } else if (signUpState instanceof SignInCompletedState) {
            return (
                <div style={styles.signed_in_msg}>
                    Sign up completed! Automatically sign in as {data?.getAccount().username}
                </div>
            );
        } else {
            return (
                <InitialForm
                    onSubmit={handleInitialSubmit}
                    firstName={firstName}
                    setFirstName={setFirstName}
                    lastName={lastName}
                    setLastName={setLastName}
                    jobTitle={jobTitle}
                    setJobTitle={setJobTitle}
                    city={city}
                    setCity={setCity}
                    country={country}
                    setCountry={setCountry}
                    email={email}
                    setEmail={setEmail}
                    loading={loading}
                />
            );
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Sign Up</h2>
            {renderForm()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
