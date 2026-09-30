"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
    AuthFlowStateBase,
    CodeRequiredStateV2,
    CompletedStateV2,
    MFARequiredStateV2,
    MFAVerificationRequiredStateV2,
    PasswordRequiredStateV2,
} from "@azure/msal-browser/custom-auth";
import type { CustomAuthAccountData } from "@azure/msal-browser/custom-auth";
import { AuthStepLayout } from "../components/AuthStepLayout";
import { PasswordForm } from "../components/forms/PasswordForm";
import { CodeForm } from "../components/forms/CodeForm";
import { V2MfaFlow } from "./V2MfaFlow";
import { getV2ErrorMessage } from "./utils/getV2ErrorMessage";
import type { AuthFlowProps, InitialCredentials } from "../types";

type V2SignInFlowProps = Omit<Extract<AuthFlowProps, { version: "v2"; action: "signIn" }>, "version" | "action">;

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected sign-in error occurred.";
}

export function startV2SignIn(app: AuthFlowProps["app"], credentials: InitialCredentials) {
    return app.signInV2({
        username: credentials.username,
        password: credentials.password || undefined,
    });
}

export function V2SignInFlow({
    initialResult,
    onCancel,
    onCompleted,
}: V2SignInFlowProps) {
    const handledInitialResult = useRef(false);
    const onCompletedRef = useRef(onCompleted);
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [mfaBusy, setMfaBusy] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [signInState, setSignInState] = useState<AuthFlowStateBase | null>(null);

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
        setSignInState(null);
        setResendCountdown(0);
        setLoading(true);

        if (initialResult.isFailed()) {
            setError(getV2ErrorMessage(initialResult.error));
        } else if (initialResult.isState("passwordRequired")) {
            setSignInState(initialResult.state);
        } else if (initialResult.isState("codeRequired")) {
            setSignInState(initialResult.state);
        } else if (initialResult.isState("mfaRequired")) {
            setSignInState(initialResult.state);
        } else if (initialResult.isState("completed")) {
            setSignInState(initialResult.state);
            setCode("");
            onCompletedRef.current(initialResult.data);
        } else {
            setError("Sign-in returned an unsupported state.");
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
        setSignInState(state);
        setCode("");
        onCompletedRef.current(account);
    };

    const handleCancel = () => {
        setCode("");
        onCancel();
    };

    const handlePasswordSubmit = async (password: string) => {
        if (!(signInState instanceof PasswordRequiredStateV2)) {
            setError("Restart sign-in before submitting a password.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await signInState.submitPassword(password);
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (result.isState("completed")) {
                complete(result.state, result.data);
            } else if (result.isState("mfaRequired")) {
                setSignInState(result.state);
            } else {
                setError("Password submission returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!(signInState instanceof CodeRequiredStateV2)) {
            setError("Restart sign-in before submitting a verification code.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await signInState.submitCode(code);

            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    setError(getV2ErrorMessage(result.error));
                } else if (result.error?.isInvalidInput()) {
                    setError(getV2ErrorMessage(result.error));
                } else if (result.error?.isBrowserRequired()) {
                    setError(getV2ErrorMessage(result.error));
                } else {
                    setError(getV2ErrorMessage(result.error));
                }
                return;
            }

            if (result.isState("completed")) {
                complete(result.state, result.data);
            } else if (result.isState("mfaRequired")) {
                setCode("");
                setSignInState(result.state);
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
        if (!(signInState instanceof CodeRequiredStateV2)) {
            setError("Restart sign-in before requesting another code.");
            return;
        }

        setError("");
        setResendLoading(true);
        try {
            const result = await signInState.resendCode();

            if (result.isFailed()) {
                if (result.error?.isBrowserRequired()) {
                    setError(getV2ErrorMessage(result.error));
                } else {
                    setError(getV2ErrorMessage(result.error));
                }
                return;
            }

            setCode("");
            setResendCountdown(30);
            setSignInState(result.state);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setResendLoading(false);
        }
    };

    let content;
    if (signInState instanceof PasswordRequiredStateV2) {
        content = (
            <PasswordForm
                onSubmit={handlePasswordSubmit}
                noValidate
                loading={loading}
                submitButtonText="Sign In"
                submitButtonLoadingText="Signing in..."
            />
        );
    } else if (signInState instanceof MFARequiredStateV2 || signInState instanceof MFAVerificationRequiredStateV2) {
        content = (
            <V2MfaFlow
                state={signInState}
                onStateChange={setSignInState}
                onCompleted={complete}
                onErrorChange={setError}
                onBusyChange={setMfaBusy}
            />
        );
    } else if (signInState instanceof CodeRequiredStateV2) {
        content = (
            <CodeForm
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
                showDeliveryHint
                noValidate
            />
        );
    } else if (signInState instanceof CompletedStateV2) {
        content = <div className="auth-signed-in-message">Sign-in completed.</div>;
    } else {
        content = loading ? <p>Starting sign-in...</p> : null;
    }

    return (
        <AuthStepLayout
            title="V2 Sign In"
            error={error}
            busy={loading || resendLoading || mfaBusy}
            onCancel={handleCancel}
        >
            {content}
        </AuthStepLayout>
    );
}

export default V2SignInFlow;
