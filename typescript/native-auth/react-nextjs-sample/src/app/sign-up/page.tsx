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
    MfaAwaitingState,
    MfaVerificationRequiredState,
} from "@azure/msal-browser/custom-auth";
import { CodeForm } from "../shared/components/CodeForm";
import { PasswordForm } from "../shared/components/PasswordForm";
import { AuthMethodRegistrationForm } from "../shared/components/AuthMethodRegistrationForm";
import { AuthMethodRegistrationChallengeForm } from "../shared/components/AuthMethodRegistrationChallengeForm";
import { MfaAuthMethodSelectionForm } from "../shared/components/MfaAuthMethodSelectionForm";
import { MfaChallengeForm } from "../shared/components/MfaChallengeForm";
import { PopupRequest } from "@azure/msal-browser";

export default function SignUpPassword() {
    const [authClient, setAuthClient] = useState<ICustomAuthPublicClientApplication | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");
    const [email, setEmail] = useState("");
    const [flatUsername, setFlatUsername] = useState("");
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
            flatusername: flatUsername,
        };

        const result = await authClient.signUp({
            username: email,
            attributes,
        });
        const state = result.state;

        if (result.isFailed()) {
            if (result.error?.isUserAlreadyExists()) {
                setError("An account with this email or username already exists");
            } else if (result.error?.isInvalidUsername()) {
                setError("Invalid username");
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
                setAuthMethodsForRegistration(result.state.getAuthMethods());
                const methods = result.state.getAuthMethods();
                setSelectedAuthMethodForRegistration(methods.length > 0 ? methods[0] : undefined);
                setSignUpState(result.state);
            } else if (result.isMfaRequired()) {
                const methods = result.state.getAuthMethods();
                setMfaAuthMethods(methods);
                setSelectedMfaAuthMethod(methods.length > 0 ? methods[0] : undefined);
                setSignUpState(state);
            } else if (result.isCompleted()) {
                setData(result.data);
                setSignUpState(state);
                setSignInState(true);
            }
        }
    };

    const handleAuthMethodRegistrationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!selectedAuthMethodForRegistration || !verificationContactForRegistration) {
            setError("Please select an authentication method and enter a verification contact.");
            setLoading(false);
            return;
        }

        if (signUpState instanceof AuthMethodRegistrationRequiredState) {
            const result = await signUpState.challengeAuthMethod({
                authMethodType: selectedAuthMethodForRegistration,
                verificationContact: verificationContactForRegistration,
            });

            if (result.isFailed()) {
                if (result.error?.isInvalidInput && result.error.isInvalidInput()) {
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
                setSignUpState(result.state);
                setSignInState(true);
            }

            if (result.isVerificationRequired && result.isVerificationRequired()) {
                setSignUpState(result.state);
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

        if (signUpState instanceof AuthMethodVerificationRequiredState) {
            const result = await signUpState.submitChallenge(challengeForRegistration);

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

    const handleMfaAuthMethodSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!selectedMfaAuthMethod) {
            setError("Please select an authentication method.");
            setLoading(false);
            return;
        }

        if (signUpState instanceof MfaAwaitingState) {
            const result = await signUpState.requestChallenge(selectedMfaAuthMethod.id);

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
                setSignUpState(result.state);
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

        if (signUpState instanceof MfaVerificationRequiredState) {
            const result = await signUpState.submitChallenge(mfaChallenge);

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
                setSignUpState(result.state);
            }
        }

        setLoading(false);
    };

    const startSignUpWithSocial = async (domainHint: string) => {
        setError("");
        setLoading(false);

        if (!authClient) return;

        const popUpRequest: PopupRequest = {
            authority: customAuthConfig.auth.authority,
            scopes: [],
            redirectUri: customAuthConfig.auth.redirectUri || "",
            prompt: "login",
            domainHint: domainHint,
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
                setData(accountResult.data);
                setSignInState(true);
            }
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("An unexpected error occurred while logging in with popup");
            }
        }
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
                    submitButtonText="Submit Password"
                    submitButtonLoadingText="Submitting..."
                />
            );
        } else if (signUpState instanceof SignUpCompletedState) {
            return <div style={styles.signed_in_msg}>Sign up completed! Signing you in automatically...</div>;
        } else if (signUpState instanceof AuthMethodRegistrationRequiredState) {
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
        } else if (signUpState instanceof AuthMethodVerificationRequiredState) {
            return (
                <AuthMethodRegistrationChallengeForm
                    onSubmit={handleAuthMethodRegistrationChallengeSubmit}
                    challenge={challengeForRegistration}
                    setChallenge={setChallengeForRegistration}
                    loading={loading}
                    styles={styles}
                />
            );
        } else if (signUpState instanceof MfaAwaitingState) {
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
        } else if (signUpState instanceof MfaVerificationRequiredState) {
            return (
                <MfaChallengeForm
                    onSubmit={handleMfaChallengeSubmit}
                    challenge={mfaChallenge}
                    setChallenge={setMfaChallenge}
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
                    flatUsername={flatUsername}
                    setFlatUsername={setFlatUsername}
                    loading={loading}
                    onSignUpWithSocial={startSignUpWithSocial}
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
