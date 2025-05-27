"use client";

import { useEffect, useState } from "react";
import { AuthFlowStateBase, CustomAuthAccountData, CustomAuthPublicClientApplication, ICustomAuthPublicClientApplication, SignInCompletedState } from "@azure/msal-browser/custom-auth";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialForm } from "./components/InitialForm";
import { PasswordForm } from "./components/PasswordForm";
import { CodeForm } from "./components/CodeForm";
import { UserInfo } from "./components/UserInfo";
import { SignInCodeRequiredState, SignInPasswordRequiredState } from "@azure/msal-browser/custom-auth";
import { PopupRequest } from "@azure/msal-browser";

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
            console.error(result.error?.isPasswordIncorrect());
            console.error(result.error?.errorData);

            if (result.error?.isUserNotFound()) {
                setError("User not found");
            }  else if (result.error?.isInvalidUsername()) {
                setError("Username is invalid");
            } else if (result.error?.isPasswordIncorrect()) {
                setError("Password is invalid");
            } else if (result.error?.isRedirectRequired()) {
                // Fallback to the delegated authentication flow.
                const popUpRequest: PopupRequest = {
                    authority: customAuthConfig.auth.authority,
                    scopes: [],
                    redirectUri: customAuthConfig.auth.redirectUri || "",
                }

                await authClient.loginPopup(popUpRequest);

                const accountResult = authClient.getCurrentAccount();

                if (accountResult.isFailed()) {
                    setError(accountResult.error?.errorData?.errorDescription ?? "An error occurred while getting the account from cache");
                }

                if (accountResult.isCompleted()) {
                    result.state = new SignInCompletedState();
                    result.data = accountResult.data;
                }
            } else {
                setError(`An error occurred: ${result.error?.errorData?.errorDescription}`);
            }
        }

        if (result.isCompleted()) {
            setData(result.data);
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
            return <CodeForm onSubmit={handleCodeSubmit} code={code} setCode={setCode} loading={loading} />;
        }

        return (
            <InitialForm
                onSubmit={startSignIn}
                username={username}
                setUsername={setUsername}
                loading={loading}
            />
        );
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
