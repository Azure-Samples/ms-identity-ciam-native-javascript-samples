"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
    AuthFlowStateBase,
    CompletedStateV2,
    MFARequiredStateV2,
    MFAVerificationRequiredStateV2,
} from "@azure/msal-browser/custom-auth";
import type { CustomAuthAccountData } from "@azure/msal-browser/custom-auth";
import { CodeForm } from "../components/forms/CodeForm";
import { MethodSelectionForm } from "../components/forms/MethodSelectionForm";
import { getV2ErrorMessage } from "./utils/getV2ErrorMessage";

interface V2MfaFlowProps {
    state: MFARequiredStateV2 | MFAVerificationRequiredStateV2;
    onStateChange: (state: AuthFlowStateBase) => void;
    onCompleted: (state: CompletedStateV2, account?: CustomAuthAccountData) => void;
    onErrorChange: (error: string) => void;
    onBusyChange: (busy: boolean) => void;
}

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected sign-in error occurred.";
}

export function V2MfaFlow({
    state,
    onStateChange,
    onCompleted,
    onErrorChange,
    onBusyChange,
}: V2MfaFlowProps) {
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);

    useEffect(() => {
        onErrorChange(error);
    }, [error, onErrorChange]);

    useEffect(() => {
        onBusyChange(loading || resendLoading);
        return () => onBusyChange(false);
    }, [loading, resendLoading, onBusyChange]);

    useEffect(() => {
        if (resendCountdown <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setResendCountdown((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCountdown]);

    const handleMethodSubmit = async (id: string) => {
        if (!(state instanceof MFARequiredStateV2)) {
            setError("Restart sign-in before selecting an MFA method.");
            return;
        }

        const method = state.methods.find((item) => item.id === id);
        if (!method) {
            setError("The selected verification method is no longer available.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.requestChallenge(method);
            if (result.isFailed()) {
                if (result.error?.isInvalidInput()) {
                    setError(getV2ErrorMessage(result.error));
                } else if (result.error?.isBrowserRequired()) {
                    setError(getV2ErrorMessage(result.error));
                } else {
                    setError(getV2ErrorMessage(result.error));
                }
                return;
            }

            setCode("");
            onStateChange(result.state);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!(state instanceof MFAVerificationRequiredStateV2)) {
            setError("Restart sign-in before submitting a verification code.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.submitChallenge(code);
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
                onCompleted(result.state, result.data);
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
        if (!(state instanceof MFAVerificationRequiredStateV2)) {
            setError("Restart sign-in before requesting another code.");
            return;
        }

        setError("");
        setResendLoading(true);
        try {
            const result = await state.resendChallenge();
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
            onStateChange(result.state);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setResendLoading(false);
        }
    };

    if (state instanceof MFARequiredStateV2) {
        return (
            <MethodSelectionForm
                options={state.methods.map((method) => ({
                    value: method.id,
                    label: `${method.type}${method.hint ? ` (${method.hint})` : ""}`,
                }))}
                onSubmit={handleMethodSubmit}
                loading={loading}
                description="Choose how to receive your verification code:"
                submitText="Send code"
                submittingText="Sending..."
            />
        );
    }

    return (
        <CodeForm
            onSubmit={handleCodeSubmit}
            code={code}
            setCode={setCode}
            loading={loading}
            onResendCode={handleResendCode}
            resendCountdown={resendCountdown}
            resendLoading={resendLoading}
            sentTo={state.sentTo}
            channel={state.channel}
            codeLength={state.codeLength}
            showDeliveryHint
            noValidate
        />
    );
}
