"use client";

import { useEffect, useState } from "react";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialFormWithPassword } from "./components/InitialFormWithPassword";
import {
    AuthFlowStateBase,
    CustomAuthPublicClientApplication,
    ICustomAuthPublicClientApplication,
    SignUpCodeRequiredState,
    SignUpCompletedState,
    SignUpPasswordRequiredState,
    UserAccountAttributes,
} from "@azure/msal-browser/custom-auth";
import { SignUpResultPage } from "./components/SignUpResult";
import { CodeForm } from "./components/CodeForm";
import { PasswordForm } from "./components/PasswordForm";

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

        const attributes = new UserAccountAttributes();
        attributes.setDisplayName(`${firstName} ${lastName}`);
        attributes.setSurname(lastName);
        attributes.setGivenName(firstName);
        attributes.setJobTitle(jobTitle);
        attributes.setCity(city);
        attributes.setCountry(country);

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
                    setError(result.error?.errorData.errorDescription || "An error occurred while submitting the password");
                }
            } else {
                setSignUpState(state);
            }
        }

        setLoading(false);
    };

    const renderForm = () => {
        if (loadingAccountStatus) {
            return;
        }

        if (isSignedIn) {
            return (
                <div style={styles.signed_in_msg}>Please sign out before processing the sign up.</div>
            );
        }

        if (signUpState instanceof SignUpCodeRequiredState) {
            return (
                <CodeForm
                    onSubmit={handleCodeSubmit}
                    code={code}
                    setCode={setCode}
                    loading={loading}
                />
            );
        } else if(signUpState instanceof SignUpPasswordRequiredState) {
            return <PasswordForm
                onSubmit={handlePasswordSubmit}
                password={password}
                setPassword={setPassword}
                loading={loading}
            />;
        } else if (signUpState instanceof SignUpCompletedState) {
            return <SignUpResultPage />;
        } else {
            return (
                <InitialFormWithPassword
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
    }

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Sign Up</h2>
            {renderForm()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
