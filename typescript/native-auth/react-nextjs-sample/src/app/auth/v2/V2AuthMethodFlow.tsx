"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
    AuthFlowStateBase,
    AuthMethodRegistrationRequiredStateV2,
    AuthMethodSelectionRequiredStateV2,
    AuthMethodVerificationRequiredStateV2,
    CompletedStateV2,
    MFAVerificationRequiredStateV2,
} from "@azure/msal-browser/custom-auth";
import type { AuthenticationMethodRegistrationV2, CustomAuthAccountData } from "@azure/msal-browser/custom-auth";
import { AuthMethodRegistrationForm } from "../components/forms/AuthMethodRegistrationForm";
import { CodeForm } from "../components/forms/CodeForm";
import { MethodSelectionForm } from "../components/forms/MethodSelectionForm";
import { getV2ErrorMessage } from "./utils/getV2ErrorMessage";

interface V2AuthMethodFlowProps {
    state:
        | AuthMethodSelectionRequiredStateV2
        | MFAVerificationRequiredStateV2
        | AuthMethodRegistrationRequiredStateV2
        | AuthMethodVerificationRequiredStateV2;
    onStateChange: (state: AuthFlowStateBase) => void;
    onCompleted: (state: CompletedStateV2, account?: CustomAuthAccountData) => void;
    onErrorChange: (error: string) => void;
    onBusyChange: (busy: boolean) => void;
}

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected sign-in error occurred.";
}

export function V2AuthMethodFlow({
    state,
    onStateChange,
    onCompleted,
    onErrorChange,
    onBusyChange,
}: V2AuthMethodFlowProps) {
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [selectedRegistrationMethod, setSelectedRegistrationMethod] =
        useState<AuthenticationMethodRegistrationV2 | null>(null);
    const [registrationContact, setRegistrationContact] = useState("");

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
        if (!(state instanceof AuthMethodSelectionRequiredStateV2)) {
            setError("Restart sign-in before selecting an authentication method.");
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
            const result = await state.selectAuthMethod(method);
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
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
        if (
            !(state instanceof MFAVerificationRequiredStateV2) &&
            !(state instanceof AuthMethodVerificationRequiredStateV2)
        ) {
            setError("Restart sign-in before submitting a verification code.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.submitChallenge(code);
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (result.isState("completed")) {
                setCode("");
                setResendCountdown(0);
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
        if (
            !(state instanceof MFAVerificationRequiredStateV2) &&
            !(state instanceof AuthMethodVerificationRequiredStateV2)
        ) {
            setError("Restart sign-in before requesting another code.");
            return;
        }

        setError("");
        setResendLoading(true);
        try {
            const result = await state.resendChallenge();
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (
                result.state instanceof MFAVerificationRequiredStateV2 ||
                result.state instanceof AuthMethodVerificationRequiredStateV2
            ) {
                setCode("");
                setResendCountdown(30);
                onStateChange(result.state);
            } else {
                setError("Code resend returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setResendLoading(false);
        }
    };

    const handleRegistrationMethodSubmit = async (methodType: string) => {
        if (!(state instanceof AuthMethodRegistrationRequiredStateV2)) {
            setError("Restart registration before selecting an authentication method.");
            return;
        }

        const method = state.methods.find((item) => item.type === methodType);
        if (!method) {
            setError("The selected registration method is no longer available.");
            return;
        }

        setSelectedRegistrationMethod(method);
        setRegistrationContact("");
        setError("");
    };

    const handleRegistrationSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!(state instanceof AuthMethodRegistrationRequiredStateV2) || !selectedRegistrationMethod) {
            setError("Select an authentication method before registering.");
            return;
        }

        const method = state.methods.find((item) => item.type === selectedRegistrationMethod.type);
        if (!method) {
            setError("The selected registration method is no longer available.");
            return;
        }
        const contact = registrationContact.trim();
        if (!contact) {
            setError("Enter the email address or phone number to register.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.selectAuthMethod(method, contact);
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
            } else if (result.isState("authMethodVerificationRequired")) {
                setCode("");
                setResendCountdown(0);
                setSelectedRegistrationMethod(null);
                setRegistrationContact("");
                onStateChange(result.state);
            } else {
                setError("Method registration returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    if (state instanceof AuthMethodSelectionRequiredStateV2) {
        return (
            <MethodSelectionForm
                options={state.methods.map((method) => ({
                    value: method.id,
                    label: `${method.type}${method.hint ? ` (${method.hint})` : ""}`,
                }))}
                onSubmit={handleMethodSubmit}
                loading={loading}
                description="Choose an authentication method:"
                submitText="Continue"
                submittingText="Continuing..."
            />
        );
    }

    if (state instanceof AuthMethodRegistrationRequiredStateV2) {
        if (!selectedRegistrationMethod) {
            return (
                <MethodSelectionForm
                    options={state.methods.map((method) => ({
                        value: method.type,
                        label: `${method.type}${method.channels?.length ? ` (${method.channels.join(", ")})` : ""}`,
                    }))}
                    onSubmit={handleRegistrationMethodSubmit}
                    loading={loading}
                    description="Choose an authentication method to register:"
                    submitText="Continue"
                    submittingText="Continuing..."
                />
            );
        }

        const isEmail = selectedRegistrationMethod.type === "email";
        return (
            <AuthMethodRegistrationForm
                onSubmit={handleRegistrationSubmit}
                verificationContact={registrationContact}
                onContactChange={setRegistrationContact}
                contactType={isEmail ? "email" : "tel"}
                contactLabel={isEmail ? "Email address" : "Phone number (with country code)"}
                contactAutoComplete={isEmail ? "email" : "tel"}
                loading={loading}
                canSubmit={Boolean(registrationContact.trim())}
                onChooseAnotherMethod={() => {
                    setSelectedRegistrationMethod(null);
                    setRegistrationContact("");
                    setError("");
                }}
            />
        );
    }

    const isActivation = state instanceof AuthMethodVerificationRequiredStateV2;
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
            channel={isActivation ? state.type : state.channel}
            codeLength={state.codeLength}
            placeholder={isActivation ? "Enter activation code" : "Enter verification code"}
            submitButtonText={isActivation ? "Activate method" : "Verify Code"}
            submitButtonLoadingText={isActivation ? "Activating..." : "Verifying..."}
            showDeliveryHint
            noValidate
            useAuthStyles={isActivation}
        />
    );
}
