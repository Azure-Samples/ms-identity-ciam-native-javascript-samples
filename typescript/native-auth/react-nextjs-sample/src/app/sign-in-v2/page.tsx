"use client";

import { useEffect, useState } from "react";
import {
    AuthFlowStateBase,
    CompletedStateV2,
    CustomAuthAccountData,
    CustomAuthPublicClientApplication,
    CodeRequiredStateV2,
    ICustomAuthPublicClientApplicationV2,
    MFARequiredStateV2,
    MFAVerificationRequiredStateV2,
    PasswordRequiredStateV2,
} from "@azure/msal-browser/custom-auth";
import type { AuthenticationMethodV2 } from "@azure/msal-browser/custom-auth";
import { customAuthConfig } from "../../config/auth-config";
import { PasswordForm } from "../shared/components/PasswordForm";
import { ChallengeFormV2 } from "../shared/v2/components/ChallengeFormV2";
import { ForceRefreshToken } from "../shared/components/ForceRefreshToken";
import { MethodSelectionFormV2 } from "../shared/v2/components/MethodSelectionFormV2";
import { UserInfo } from "../sign-in/components/UserInfo";
import { styles } from "../sign-in/styles/styles";

export default function SignInV2() {
    const [app, setApp] = useState<ICustomAuthPublicClientApplicationV2 | null>(null);
    const [loadingAccountStatus, setLoadingAccountStatus] = useState(true);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [signInState, setSignInState] = useState<AuthFlowStateBase | null>(null);
    const [data, setData] = useState<CustomAuthAccountData | undefined>();

    useEffect(() => {
        const initializeApp = async () => {
            const appInstance = await CustomAuthPublicClientApplication.create(customAuthConfig);
            setApp(appInstance);
        };

        initializeApp();
    }, []);

    useEffect(() => {
        if (!app) {
            return;
        }

        const accountResult = app.getCurrentAccount();
        if (accountResult.isCompleted()) {
            setData(accountResult.data);
            setIsSignedIn(true);
        }

        setLoadingAccountStatus(false);
    }, [app]);

    useEffect(() => {
        if (resendCountdown <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setResendCountdown((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCountdown]);

    const handleCompleted = (state: CompletedStateV2, accountData: CustomAuthAccountData | undefined) => {
        setSignInState(state);
        setData(accountData);
        setIsSignedIn(true);
        setPassword("");
    };

    const handleInitialSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!app) {
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await app.signInV2({
                username,
                password: password || undefined,
                scopes: [],
            });

            if (result.isFailed()) {
                if (result.error?.isInvalidInput()) {
                    setError("Enter a valid username.");
                } else if (result.error?.isInvalidUsername()) {
                    setError("The username is empty or invalid.");
                } else if (result.error?.isUserNotFound()) {
                    setError("User not found.");
                } else if (result.error?.isInvalidPassword()) {
                    setError("Incorrect password.");
                } else if (result.error?.isBrowserRequired()) {
                    setError("Sign-in must be completed in a browser.");
                } else {
                    setError(result.error?.errorDescription || "An error occurred while signing in.");
                }
                return;
            }

            if (result.isState("passwordRequired")) {
                setSignInState(result.state);
                return;
            }

            if (result.isState("codeRequired")) {
                setCode("");
                setSignInState(result.state);
                return;
            }

            if (result.isState("mfaRequired")) {
                setSignInState(result.state);
                return;
            }

            if (result.isState("completed")) {
                handleCompleted(result.state, result.data);
                return;
            }

            setError("Sign-in returned an unsupported state.");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(signInState instanceof PasswordRequiredStateV2)) {
            setError("Restart sign-in before submitting a password.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await signInState.submitPassword(password);

            if (result.isFailed()) {
                if (result.error?.isInvalidInput()) {
                    setError("Enter a password.");
                } else if (result.error?.isInvalidPassword()) {
                    setError("Incorrect password.");
                } else if (result.error?.isBrowserRequired()) {
                    setError("Sign-in must be completed in a browser.");
                } else {
                    setError(result.error?.errorDescription || "An error occurred while verifying the password.");
                }
                return;
            }

            if (result.isState("completed")) {
                handleCompleted(result.state, result.data);
                return;
            }

            if (result.isState("mfaRequired")) {
                setSignInState(result.state);
                setPassword("");
                return;
            }

            setError("Password submission returned an unsupported state.");
        } finally {
            setLoading(false);
        }
    };

    const handleMethodSubmit = async (method: AuthenticationMethodV2) => {
        if (!(signInState instanceof MFARequiredStateV2)) {
            setError("Restart sign-in before selecting an MFA method.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await signInState.requestChallenge(method);

            if (result.isFailed()) {
                if (result.error?.isInvalidInput()) {
                    setError("Select an authentication method offered by the service.");
                } else if (result.error?.isBrowserRequired()) {
                    setError("This authentication method must be completed in a browser.");
                } else {
                    setError(
                        result.error?.errorDescription || "An error occurred while requesting the verification code.",
                    );
                }
                return;
            }

            setCode("");
            setSignInState(result.state);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (
            !(
                signInState instanceof CodeRequiredStateV2 ||
                signInState instanceof MFAVerificationRequiredStateV2
            )
        ) {
            setError("Restart sign-in before submitting a verification code.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result =
                signInState instanceof CodeRequiredStateV2
                    ? await signInState.submitCode(code)
                    : await signInState.submitChallenge(code);

            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    setError("The verification code is invalid or expired.");
                } else if (result.error?.isInvalidInput()) {
                    setError("Enter the complete verification code.");
                } else if (result.error?.isBrowserRequired()) {
                    setError("Code verification must be completed in a browser.");
                } else {
                    setError(result.error?.errorDescription || "An error occurred while verifying the code.");
                }
                return;
            }

            if (result.isState("completed")) {
                handleCompleted(result.state, result.data);
                return;
            }

            if (result.isState("mfaRequired")) {
                setSignInState(result.state);
                setCode("");
                return;
            }

            setError("Code verification returned an unsupported state.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async (event: React.FormEvent) => {
        event.preventDefault();
        if (
            !(
                signInState instanceof CodeRequiredStateV2 ||
                signInState instanceof MFAVerificationRequiredStateV2
            )
        ) {
            setError("Restart sign-in before requesting another code.");
            return;
        }

        setError("");
        setResendLoading(true);

        try {
            const result =
                signInState instanceof CodeRequiredStateV2
                    ? await signInState.resendCode()
                    : await signInState.resendChallenge();

            if (result.isFailed()) {
                if (result.error?.isBrowserRequired()) {
                    setError("Resending the code requires continuing in a browser.");
                } else {
                    setError(result.error?.errorDescription || "An error occurred while resending the code.");
                }
                return;
            }

            setCode("");
            setResendCountdown(30);
            setSignInState(result.state);
        } finally {
            setResendLoading(false);
        }
    };

    const renderContent = () => {
        if (loadingAccountStatus) {
            return <div>Checking account status...</div>;
        }

        if (isSignedIn) {
            return data ? (
                <>
                    <UserInfo userData={data} />
                    <ForceRefreshToken accountData={data} />
                </>
            ) : (
                <div style={styles.signed_in_msg}>The user is signed in.</div>
            );
        }

        if (signInState instanceof PasswordRequiredStateV2) {
            return (
                <PasswordForm
                    onSubmit={handlePasswordSubmit}
                    password={password}
                    setPassword={setPassword}
                    loading={loading}
                    submitButtonText="Sign In"
                    submitButtonLoadingText="Signing in..."
                />
            );
        }

        if (signInState instanceof MFARequiredStateV2) {
            return (
                <MethodSelectionFormV2 methods={signInState.methods} onSubmit={handleMethodSubmit} loading={loading} />
            );
        }

        if (
            signInState instanceof CodeRequiredStateV2 ||
            signInState instanceof MFAVerificationRequiredStateV2
        ) {
            return (
                <ChallengeFormV2
                    onSubmit={handleCodeSubmit}
                    code={code}
                    setCode={setCode}
                    loading={loading}
                    onResendCode={handleResendCode}
                    resendCountdown={resendCountdown}
                    resendLoading={resendLoading}
                    sentTo={signInState.sentTo}
                    channel={signInState.channel}
                    codeLength={signInState.codeLength}
                />
            );
        }

        return (
            <form onSubmit={handleInitialSubmit} style={styles.form}>
                <input
                    type="text"
                    placeholder="Email or Username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    style={styles.input}
                    required
                />
                <input
                    type="password"
                    placeholder="Password (optional)"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    style={styles.input}
                />
                <div>
                    Provide a password to prefer password sign-in. Leave it empty to prefer email OTP; if email OTP is
                    unavailable, the app will ask for a password next.
                </div>
                <button type="submit" style={loading ? styles.buttonDisabled : styles.button} disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                </button>
            </form>
        );
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Sign In (V2)</h2>
            {renderContent()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
