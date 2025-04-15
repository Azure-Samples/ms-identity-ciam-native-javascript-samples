"use client";

import { useState } from "react";
import { CustomAuthPublicClientApplication, SignInCompletedState } from "@azure/msal-custom-auth";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { handleError } from "./utils";
import { InitialForm } from "./components/InitialForm";
import { PasswordForm } from "./components/PasswordForm";
import { CodeForm } from "./components/CodeForm";
import { UserInfo } from "./components/UserInfo";
import { SignInCodeRequiredState, SignInPasswordRequiredState } from "@azure/msal-custom-auth";
import { PopupRequest } from "@azure/msal-browser";

export default function SignIn() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [signInState, setSignInState] = useState<any>(null);
    const [data, setData] = useState<any>(null);

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const app = await CustomAuthPublicClientApplication.create(customAuthConfig);
            const account = app.getCurrentAccount();
            account.data?.signOut();

            const result = await app.signIn({
                username,
            });

            if (result.error) {
                if (result.error.isUserNotFound()) {
                    setError("User not found");
                } else if (result.error.isRedirectionRequired()) {
                    const popUpRequest: PopupRequest = {
                        authority: customAuthConfig.auth.authority,
                        scopes: [],
                        redirectUri: customAuthConfig.auth.redirectUri || "",
                    }
                    const redirectResult = await app.loginPopup(popUpRequest);
                    result.state = new SignInCompletedState()
                    setData(redirectResult.account);
                    setSignInState(result.state);
                } else {
                    setError("An error occurred during sign in");
                }
                return;
            }
            setData(result.data);
            setSignInState(result.state);
            if (result.isCompleted()) {
                return;
            }
        } catch (err) {
            handleError(err, setError);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (signInState instanceof SignInPasswordRequiredState) {
                const result = await signInState.submitPassword(password);

                if (result.error) {
                    if (result.error.errorData?.error === "invalid_password") {
                        setError("Incorrect password");
                    } else {
                        setError(
                            result.error.errorData?.errorDescription || "An error occurred while verifying the password"
                        );
                    }
                    return;
                }
                setData(result.data);
                setSignInState(result.state);
            }
        } catch (err) {
            handleError(err, setError);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (signInState instanceof SignInCodeRequiredState) {
                const result = await signInState.submitCode(code);

                if (result.error) {
                    if (result.error.isInvalidCode()) {
                        setError("Invalid code");
                    } else {
                        setError("An error occurred while verifying the code");
                    }
                    return;
                }
                setSignInState(result.state);
                setData(result.data);
            }
        } catch (err) {
            handleError(err, setError);
        } finally {
            setLoading(false);
        }
    };

    const renderForm = () => {
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
            return <CodeForm onSubmit={handleCodeSubmit} code={code} setCode={setCode} loading={loading} />;
        }
        if (signInState instanceof SignInCompletedState) {
            return <UserInfo signInState={data} />;
        }

        return (
            <InitialForm
                onSubmit={handleInitialSubmit}
                username={username}
                setUsername={setUsername}
                loading={loading}
            />
        );
    };

    return (
        <div style={styles.container}>
            <h2>Sign In</h2>
            <>
                {renderForm()}
                {error && <div style={styles.error}>{error}</div>}
            </>
        </div>
    );
}
