"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { customAuthConfig } from "../../config/auth-config";
import { styles } from "./styles/styles";
import { InitialForm } from "./components/InitialForm";
import { CodeForm } from "./components/CodeForm";
import { NewPasswordForm } from "./components/NewPasswordForm";
import { ResetPasswordResultPage } from "./components/ResetPasswordResult";
import {
    CustomAuthPublicClientApplication,
    ResetPasswordCodeRequiredState,
    ResetPasswordPasswordRequiredState,
    ResetPasswordCompletedState,
} from "@azure/msal-browser/custom-auth";

export default function ResetPassword() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resetState, setResetState] = useState<any>(null);

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const app = await CustomAuthPublicClientApplication.create(customAuthConfig);
            const account = app.getCurrentAccount();
            account.data?.signOut();

            const result = await app.resetPassword({
                username: email,
            });

            if (result.error) {
                setError(
                    result.error.errorData.errorDescription || "An error occurred while initiating password reset"
                );
                return;
            }

            setResetState(result.state);
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
            if (resetState instanceof ResetPasswordCodeRequiredState) {
                const result = await resetState.submitCode(code);

                if (result.error) {
                    if (result.error.isInvalidCode()) {
                        setError("Invalid verification code");
                    } else {
                        setError("An error occurred while verifying the code");
                    }
                    return;
                }

                setResetState(result.state);
            }
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleNewPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (resetState instanceof ResetPasswordPasswordRequiredState) {
                const result = await resetState.submitNewPassword(newPassword);

                if (result.error) {
                    setError(result.error.errorData.errorDescription || "An error occurred while setting new password");
                    return;
                }

                if (result.state instanceof ResetPasswordCompletedState) {
                    setResetState(result.state);
                }
            }
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (resetState instanceof ResetPasswordCompletedState) {
        return <ResetPasswordResultPage state={resetState} />;
    }

    return (
        <div style={styles.container}>
            <h2>Reset Password</h2>
            {resetState instanceof ResetPasswordPasswordRequiredState ? (
                <NewPasswordForm
                    onSubmit={handleNewPasswordSubmit}
                    newPassword={newPassword}
                    setNewPassword={setNewPassword}
                    loading={loading}
                />
            ) : resetState instanceof ResetPasswordCodeRequiredState ? (
                <CodeForm onSubmit={handleCodeSubmit} code={code} setCode={setCode} loading={loading} />
            ) : (
                <InitialForm onSubmit={handleInitialSubmit} email={email} setEmail={setEmail} loading={loading} />
            )}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
