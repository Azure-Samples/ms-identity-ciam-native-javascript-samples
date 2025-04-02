"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialForm } from "./components/InitialForm";
import { CodeForm } from "./components/CodeForm";
import { SignUpResultPage } from "./components/SignUpResult";
import {
    CustomAuthPublicClientApplication,
    SignUpCodeRequiredState,
    SignUpCompletedState,
    UserAccountAttributes,
} from "@azure/msal-custom-auth";

export default function SignUp() {
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [signUpState, setSignUpState] = useState<any>(null);

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const app = await CustomAuthPublicClientApplication.create(customAuthConfig);
            const account = app.getCurrentAccount();
            account.data?.signOut();

            const attributes = new UserAccountAttributes();
            attributes.setDisplayName(`${firstName} ${lastName}`);

            const result = await app.signUp({
                username: email,
                attributes,
            });
            
            if (result.error) {
                if (result.error.isUserAlreadyExists()) {
                    setError("An account with this email already exists");
                } else {
                    setError(result.error.errorData.errorDescription || "An error occurred while signing up");
                }
                return;
            }

            setSignUpState(result.state);            
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (signUpState instanceof SignUpCodeRequiredState )
            {
                const result = await signUpState.submitCode(code);
                if (result.error) {
                    if (result.error.isInvalidCode()) {
                        setError("Invalid verification code");
                    } else {
                        setError("An error occurred while verifying the code");
                    }
                    return;
                }
                if (result.isCompleted()) {
                    setSignUpState(result.state);
                }
            }
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (signUpState instanceof SignUpCompletedState) {
        return <SignUpResultPage state={signUpState} />;
    }

    return (
        <div style={styles.container}>
            <h2>Sign Up</h2>
            {signUpState instanceof SignUpCodeRequiredState ? (
                <CodeForm onSubmit={handleCodeSubmit} code={code} setCode={setCode} loading={loading} />
            ) : (
                <InitialForm
                    onSubmit={handleInitialSubmit}
                    firstName={firstName}
                    setFirstName={setFirstName}
                    lastName={lastName}
                    setLastName={setLastName}
                    email={email}
                    setEmail={setEmail}
                    loading={loading}
                />
            )}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
