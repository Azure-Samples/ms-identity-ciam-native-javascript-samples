"use client";

import { useEffect, useState } from "react";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialFormWithPassword } from "./components/InitialFormWithPassword";
import {
    CustomAuthPublicClientApplication,
    ICustomAuthPublicClientApplication,
    SignUpCodeRequiredState,
    SignUpCompletedState,
    UserAccountAttributes,
} from "@azure/msal-custom-auth";
import { SignUpResultPage } from "./components/SignUpResult";
import { CodeForm } from "./components/CodeForm";

export default function SignUpPassword() {
    const [authClient, setAuthClient] = useState<ICustomAuthPublicClientApplication | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [signUpState, setSignUpState] = useState<any>(null);
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

        const result = await authClient.signUp({
            username: email,
            password: password,
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

    const renderForm = () => {
        if (loadingAccountStatus) {
            return;
        }

        if (isSignedIn) {
            return (
                <div style={{
                    padding: "20px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    marginTop: "20px",
                }}>Please sign out before processing the sign up.</div>
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
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    loading={loading}
                />
            );
        }
    }

    return (
        <div style={styles.container}>
            <h2>Sign Up with Password</h2>
            {renderForm()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
