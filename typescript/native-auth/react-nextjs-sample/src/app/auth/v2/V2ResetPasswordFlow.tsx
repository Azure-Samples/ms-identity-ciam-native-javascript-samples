"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
    AuthFlowStateBase,
    AuthMethodSelectionRequiredStateV2,
    CodeRequiredStateV2,
    CompletedStateV2,
    NewPasswordRequiredStateV2,
    SignInContinuationStateV2,
} from "@azure/msal-browser/custom-auth";
import type { AuthenticationMethodV2, CustomAuthAccountData } from "@azure/msal-browser/custom-auth";
import { AuthStepLayout } from "../components/AuthStepLayout";
import { NewPasswordForm } from "../components/forms/NewPasswordForm";
import { CodeForm } from "../components/forms/CodeForm";
import { MethodSelectionForm } from "../components/forms/MethodSelectionForm";
import { getV2ErrorMessage } from "./utils/getV2ErrorMessage";
import type { AuthFlowProps } from "../types";

type V2ResetPasswordFlowProps = Omit<
    Extract<AuthFlowProps, { version: "v2"; action: "resetPassword" }>,
    "version" | "action"
>;

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected password reset error occurred.";
}

export function startV2ResetPassword(app: AuthFlowProps["app"], username: string) {
    return app.resetPasswordV2({ username });
}

export function V2ResetPasswordFlow({
    initialResult,
    onCancel,
    onCompleted,
}: V2ResetPasswordFlowProps) {
    const handledInitialResult = useRef(false);
    const onCompletedRef = useRef(onCompleted);
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [resetState, setResetState] = useState<AuthFlowStateBase | null>(null);

    useEffect(() => {
        onCompletedRef.current = onCompleted;
    }, [onCompleted]);

    useEffect(() => {
        if (handledInitialResult.current) {
            return;
        }

        handledInitialResult.current = true;
        setCode("");
        setError("");
        setResetState(null);
        setResendCountdown(0);
        setLoading(true);

        if (initialResult.isFailed()) {
            setError(getV2ErrorMessage(initialResult.error));
        } else if (
            initialResult.isState("authMethodSelectionRequired") ||
            initialResult.isState("codeRequired")
        ) {
            setResetState(initialResult.state);
        } else {
            setError("Password reset returned an unsupported state.");
        }
        setLoading(false);
    }, [initialResult]);

    useEffect(() => {
        if (resendCountdown <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setResendCountdown((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCountdown]);

    const complete = (state: CompletedStateV2, account?: CustomAuthAccountData) => {
        setResetState(state);
        setCode("");
        onCompletedRef.current(account);
    };

    const handleCancel = () => {
        setCode("");
        onCancel();
    };

    const continueSignIn = async (continuationState: SignInContinuationStateV2) => {
        setResetState(continuationState);
        setError("");
        setLoading(true);
        try {
            const result = await continuationState.signIn();
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
            } else if (result.isState("completed")) {
                complete(result.state, result.data);
            } else {
                setError("Sign-in after password reset returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleMethodSubmit = async (method: AuthenticationMethodV2) => {
        if (!(resetState instanceof AuthMethodSelectionRequiredStateV2)) {
            setError("Restart password reset before selecting a verification method.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await resetState.requestChallenge(method);
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (result.isState("codeRequired")) {
                setCode("");
                setResetState(result.state);
            } else {
                setError("Verification challenge request returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!(resetState instanceof CodeRequiredStateV2)) {
            setError("Restart password reset before submitting a verification code.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await resetState.submitCode(code);
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (result.isState("newPasswordRequired")) {
                setCode("");
                setResetState(result.state);
            } else {
                setError("Code verification returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async (event: FormEvent) => {
        event.preventDefault();
        if (!(resetState instanceof CodeRequiredStateV2)) {
            setError("Restart password reset before requesting another code.");
            return;
        }

        setError("");
        setResendLoading(true);
        try {
            const result = await resetState.resendCode();
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            setCode("");
            setResendCountdown(30);
            setResetState(result.state);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setResendLoading(false);
        }
    };

    const handleNewPasswordSubmit = async (newPassword: string) => {
        if (!(resetState instanceof NewPasswordRequiredStateV2)) {
            setError("Restart password reset before submitting a new password.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await resetState.submitNewPassword(newPassword);
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (result.isState("signInContinuation")) {
                await continueSignIn(result.state);
            } else {
                setError("New password submission returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    let content;
    if (resetState instanceof AuthMethodSelectionRequiredStateV2) {
        content = (
            <MethodSelectionForm
                options={resetState.methods.map((method) => ({
                    value: method.id,
                    label: `${method.type}${method.hint ? ` (${method.hint})` : ""}`,
                }))}
                onSubmit={async (id) => {
                    const method = resetState.methods.find((item) => item.id === id);
                    if (!method) {
                        setError("The selected verification method is no longer available.");
                        return;
                    }
                    await handleMethodSubmit(method);
                }}
                loading={loading}
                description="Choose how to receive your verification code:"
                submitText="Send code"
                submittingText="Sending..."
            />
        );
    } else if (resetState instanceof CodeRequiredStateV2) {
        content = (
            <CodeForm
                onSubmit={handleCodeSubmit}
                code={code}
                setCode={setCode}
                loading={loading}
                onResendCode={handleResendCode}
                resendCountdown={resendCountdown}
                resendLoading={resendLoading}
                sentTo={resetState.sentTo}
                channel={resetState.channel}
                codeLength={resetState.codeLength}
                showDeliveryHint
                noValidate
            />
        );
    } else if (resetState instanceof NewPasswordRequiredStateV2) {
        content = (
            <NewPasswordForm
                onSubmit={handleNewPasswordSubmit}
                loading={loading}
                noValidate
            />
        );
    } else if (resetState instanceof SignInContinuationStateV2) {
        content = loading ? (
            <p>Completing sign-in...</p>
        ) : (
            <button type="button" className="auth-button" onClick={() => void continueSignIn(resetState)}>
                Retry sign-in
            </button>
        );
    } else if (resetState instanceof CompletedStateV2) {
        content = <div className="auth-signed-in-message">Password reset completed.</div>;
    } else {
        content = loading ? <p>Starting password reset...</p> : null;
    }

    return (
        <AuthStepLayout
            title="V2 Reset Password"
            error={error}
            busy={loading || resendLoading}
            onCancel={handleCancel}
        >
            {content}
        </AuthStepLayout>
    );
}

export default V2ResetPasswordFlow;
