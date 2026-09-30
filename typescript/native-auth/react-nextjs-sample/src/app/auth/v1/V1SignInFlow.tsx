"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PopupRequest } from "@azure/msal-browser";
import {
    AuthFlowStateBase,
    CustomAuthAccountData,
    SignInCodeRequiredState,
    SignInCompletedState,
    SignInPasswordRequiredState,
} from "@azure/msal-browser/custom-auth";
import { customAuthConfig } from "../../../config/auth-config";
import { AuthStepLayout } from "../components/AuthStepLayout";
import { CodeForm } from "../components/forms/CodeForm";
import { PasswordForm } from "../components/forms/PasswordForm";
import type { AuthFlowProps, InitialCredentials } from "../types";
import { isV1MfaOrRegistrationState, V1MfaAndRegistrationFlow } from "./V1MfaAndRegistrationFlow";

type V1SignInFlowProps = Omit<Extract<AuthFlowProps, { version: "v1"; action: "signIn" }>, "version" | "action">;

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function hasFailed(result: { isFailed(): boolean }): boolean {
    return result.isFailed();
}

export function startV1SignIn(app: AuthFlowProps["app"], credentials: InitialCredentials) {
    return app.signIn({
        username: credentials.username,
        ...(credentials.password ? { password: credentials.password } : {}),
    });
}

export function V1SignInFlow({
    app,
    initialResult,
    onCancel,
    onCompleted,
}: V1SignInFlowProps) {
    const handledInitialResult = useRef(false);
    const [state, setState] = useState<AuthFlowStateBase | null>(null);
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [mfaOrRegistrationBusy, setMfaOrRegistrationBusy] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);

    useEffect(() => {
        if (resendCountdown <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setResendCountdown((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCountdown]);

    const complete = useCallback((account?: CustomAuthAccountData) => {
        setCode("");
        onCompleted(account);
    }, [onCompleted]);

    const handleCancel = () => {
        setCode("");
        onCancel();
    };

    const completeInBrowser = useCallback(async () => {
        const popupRequest: PopupRequest = {
            authority: customAuthConfig.auth.authority,
            scopes: [],
            redirectUri: customAuthConfig.auth.redirectUri || "",
            prompt: "login",
        };

        await app.loginPopup(popupRequest);
        const accountResult = app.getCurrentAccount();
        if (hasFailed(accountResult)) {
            throw new Error(
                accountResult.error?.errorData.errorDescription ||
                    "An error occurred while getting the account from the cache."
            );
        }
        if (!accountResult.isCompleted()) {
            throw new Error("Browser sign-in did not return an account.");
        }

        complete(accountResult.data);
    }, [app, complete]);

    useEffect(() => {
        if (handledInitialResult.current) {
            return;
        }
        handledInitialResult.current = true;

        setState(null);
        setCode("");
        setError("");
        setLoading(true);
        setResendCountdown(0);

        const consumeInitialResult = async () => {
            try {
                if (hasFailed(initialResult)) {
                    if (initialResult.error?.isRedirectRequired()) {
                        await completeInBrowser();
                    } else if (initialResult.error?.isUserNotFound()) {
                        setError(initialResult.error.errorData.errorDescription || "User not found.");
                    } else if (initialResult.error?.isInvalidUsername()) {
                        setError(initialResult.error.errorData.errorDescription || "Username is invalid.");
                    } else if (initialResult.error?.isPasswordIncorrect()) {
                        setError(initialResult.error.errorData.errorDescription || "Password is invalid.");
                    } else {
                        setError(
                            initialResult.error?.errorData.errorDescription || "An error occurred while signing in.",
                        );
                    }
                    return;
                }

                setState(initialResult.state);
                if (initialResult.isCompleted()) {
                    complete(initialResult.data);
                }
            } catch (caughtError) {
                setError(getThrownErrorMessage(caughtError));
            } finally {
                setLoading(false);
            }
        };

        void consumeInitialResult();
    }, [complete, completeInBrowser, initialResult]);

    const handlePasswordSubmit = async (password: string) => {
        if (!(state instanceof SignInPasswordRequiredState)) {
            setError("Start over before submitting a password.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.submitPassword(password);
            if (hasFailed(result)) {
                setError(
                    result.error?.errorData.errorDescription ||
                        (result.error?.isInvalidPassword()
                            ? "Incorrect password."
                            : "An error occurred while verifying the password.")
                );
                return;
            }

            setState(result.state);
            if (result.isCompleted()) {
                complete(result.data);
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof SignInCodeRequiredState)) {
            setError("Start over before submitting a verification code.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.submitCode(code);
            if (hasFailed(result)) {
                setError(
                    result.error?.errorData.errorDescription ||
                        (result.error?.isInvalidCode()
                            ? "Invalid verification code."
                            : "An error occurred while verifying the code.")
                );
                return;
            }

            setCode("");
            setState(result.state);
            if (result.isCompleted()) {
                complete(result.data);
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof SignInCodeRequiredState)) {
            setError("Start over before requesting another verification code.");
            return;
        }

        setError("");
        try {
            const result = await state.resendCode();
            if (hasFailed(result)) {
                setError(result.error?.errorData.errorDescription || "An error occurred while resending the code.");
                return;
            }

            setState(result.state);
            setResendCountdown(30);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        }
    };

    let content: React.ReactNode;
    if (state instanceof SignInPasswordRequiredState) {
        content = (
            <PasswordForm
                onSubmit={handlePasswordSubmit}
                loading={loading}
                submitButtonText="Sign In"
                submitButtonLoadingText="Signing in..."
            />
        );
    } else if (state instanceof SignInCodeRequiredState) {
        content = (
            <CodeForm
                onSubmit={handleCodeSubmit}
                code={code}
                setCode={setCode}
                loading={loading}
                onResendCode={handleResendCode}
                resendCountdown={resendCountdown}
            />
        );
    } else if (isV1MfaOrRegistrationState(state)) {
        content = (
            <V1MfaAndRegistrationFlow
                state={state}
                onStateChange={setState}
                onCompleted={complete}
                onErrorChange={setError}
                onBusyChange={setMfaOrRegistrationBusy}
            />
        );
    } else if (state instanceof SignInCompletedState) {
        content = <div className="auth-signed-in-message">Sign in completed.</div>;
    } else {
        content = <p className="auth-helper-text">{loading ? "Starting sign in..." : "Unable to continue sign in."}</p>;
    }

    return (
        <AuthStepLayout
            title="V1 Sign In"
            error={error ? `Error: ${error}` : ""}
            busy={loading || mfaOrRegistrationBusy}
            onCancel={handleCancel}
        >
            {content}
        </AuthStepLayout>
    );
}

export default V1SignInFlow;
