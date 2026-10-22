"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    AuthFlowStateBase,
    CustomAuthAccountData,
    ResetPasswordCodeRequiredState,
    ResetPasswordCompletedState,
    ResetPasswordPasswordRequiredState,
} from "@azure/msal-browser/custom-auth";
import { AuthStepLayout } from "../components/AuthStepLayout";
import { CodeForm } from "../components/forms/CodeForm";
import { NewPasswordForm } from "../components/forms/NewPasswordForm";
import type { AuthFlowProps } from "../types";
import { isV1MfaOrRegistrationState, V1MfaAndRegistrationFlow } from "./V1MfaAndRegistrationFlow";
import { authorizationInputs } from "../../../config/authorization-request-config";

type V1ResetPasswordFlowProps = Omit<
    Extract<AuthFlowProps, { version: "v1"; action: "resetPassword" }>,
    "version" | "action"
>;

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function hasFailed(result: { isFailed(): boolean }): boolean {
    return result.isFailed();
}

export function startV1ResetPassword(app: AuthFlowProps["app"], username: string) {
    return app.resetPassword({ username });
}

export function V1ResetPasswordFlow({ initialResult, onCancel, onCompleted }: V1ResetPasswordFlowProps) {
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

    const complete = useCallback(
        (account?: CustomAuthAccountData) => {
            setCode("");
            onCompleted(account);
        },
        [onCompleted],
    );

    const handleCancel = () => {
        setCode("");
        onCancel();
    };

    const handleAutoSignIn = async (completedState: ResetPasswordCompletedState) => {
        setError("");
        setLoading(true);

        try {
            const result = await completedState.signIn(authorizationInputs);
            if (hasFailed(result)) {
                setError(result.error?.errorData.errorDescription || "An error occurred during automatic sign in.");
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
                    if (initialResult.error?.isInvalidUsername()) {
                        setError(initialResult.error.errorData.errorDescription || "Invalid email address.");
                    } else if (initialResult.error?.isUserNotFound()) {
                        setError(initialResult.error.errorData.errorDescription || "User not found.");
                    } else {
                        setError(
                            initialResult.error?.errorData.errorDescription ||
                                "An error occurred while initiating password reset.",
                        );
                    }
                    return;
                }

                setState(initialResult.state);
            } catch (caughtError) {
                setError(getThrownErrorMessage(caughtError));
            } finally {
                setLoading(false);
            }
        };

        void consumeInitialResult();
    }, [initialResult]);

    const handleCodeSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof ResetPasswordCodeRequiredState)) {
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
                            : "An error occurred while verifying the code."),
                );
                return;
            }

            setCode("");
            setState(result.state);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof ResetPasswordCodeRequiredState)) {
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

    const handleNewPasswordSubmit = async (newPassword: string) => {
        if (!(state instanceof ResetPasswordPasswordRequiredState)) {
            setError("Start over before submitting a new password.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.submitNewPassword(newPassword);
            if (hasFailed(result)) {
                if (result.error?.isInvalidPassword()) {
                    setError(result.error.errorData.errorDescription || "Invalid password.");
                } else {
                    setError(
                        result.error?.errorData.errorDescription || "An error occurred while setting the new password.",
                    );
                }
                return;
            }

            setState(result.state);
            if (result.isCompleted()) {
                await handleAutoSignIn(result.state);
            } else {
                setError("Setting the new password returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    let content: React.ReactNode;
    if (state instanceof ResetPasswordCodeRequiredState) {
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
    } else if (state instanceof ResetPasswordPasswordRequiredState) {
        content = <NewPasswordForm onSubmit={handleNewPasswordSubmit} loading={loading} />;
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
    } else if (state instanceof ResetPasswordCompletedState) {
        content = (
            <button
                type="button"
                className={loading ? "auth-button-disabled" : "auth-button"}
                onClick={() => void handleAutoSignIn(state)}
                disabled={loading}
            >
                {loading ? "Signing in..." : "Retry automatic sign in"}
            </button>
        );
    } else {
        content = (
            <p className="auth-helper-text">
                {loading ? "Starting password reset..." : "Unable to continue password reset."}
            </p>
        );
    }

    return (
        <AuthStepLayout
            title="V1 Reset Password"
            error={error ? `Error: ${error}` : ""}
            busy={loading || mfaOrRegistrationBusy}
            onCancel={handleCancel}
        >
            {content}
        </AuthStepLayout>
    );
}

export default V1ResetPasswordFlow;
