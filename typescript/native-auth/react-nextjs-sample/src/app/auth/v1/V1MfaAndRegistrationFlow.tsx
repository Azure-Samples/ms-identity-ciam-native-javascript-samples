"use client";

import { useEffect, useState } from "react";
import {
    AuthFlowStateBase,
    AuthMethodRegistrationRequiredState,
    AuthMethodVerificationRequiredState,
    AuthenticationMethod,
    AuthMethodDetails,
    CustomAuthAccountData,
    MfaAwaitingState,
    MfaVerificationRequiredState,
} from "@azure/msal-browser/custom-auth";
import { CodeForm } from "../components/forms/CodeForm";
import { MethodSelectionForm } from "../components/forms/MethodSelectionForm";
import { AuthMethodRegistrationForm } from "./components/AuthMethodRegistrationForm";

type V1MfaOrRegistrationState =
    | AuthMethodRegistrationRequiredState
    | AuthMethodVerificationRequiredState
    | MfaAwaitingState
    | MfaVerificationRequiredState;

interface V1MfaAndRegistrationFlowProps {
    state: V1MfaOrRegistrationState;
    onStateChange: (state: AuthFlowStateBase) => void;
    onCompleted: (account?: CustomAuthAccountData) => void;
    onErrorChange: (error: string) => void;
    onBusyChange?: (busy: boolean) => void;
}

export function isV1MfaOrRegistrationState(state: AuthFlowStateBase | null): state is V1MfaOrRegistrationState {
    return (
        state instanceof AuthMethodRegistrationRequiredState ||
        state instanceof AuthMethodVerificationRequiredState ||
        state instanceof MfaAwaitingState ||
        state instanceof MfaVerificationRequiredState
    );
}

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function hasFailed(result: { isFailed(): boolean }): boolean {
    return result.isFailed();
}

export function V1MfaAndRegistrationFlow({
    state,
    onStateChange,
    onCompleted,
    onErrorChange,
    onBusyChange,
}: V1MfaAndRegistrationFlowProps) {
    const [selectedMethod, setSelectedMethod] = useState<AuthenticationMethod>();
    const [verificationContact, setVerificationContact] = useState("");
    const [challenge, setChallenge] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [registrationDetails, setRegistrationDetails] = useState<AuthMethodDetails>();
    const [resendCountdown, setResendCountdown] = useState(0);

    useEffect(() => {
        onBusyChange?.(loading);

        return () => onBusyChange?.(false);
    }, [loading, onBusyChange]);

    useEffect(() => {
        onErrorChange(error);
    }, [error, onErrorChange]);

    useEffect(() => {
        if (resendCountdown <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setResendCountdown((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCountdown]);

    useEffect(() => {
        setError("");
        setChallenge("");

        if (state instanceof AuthMethodRegistrationRequiredState || state instanceof MfaAwaitingState) {
            setSelectedMethod(state.getAuthMethods()[0]);
        } else {
            setSelectedMethod(undefined);
        }

        if (!(state instanceof AuthMethodRegistrationRequiredState)) {
            setVerificationContact("");
        }
    }, [state]);

    const handleRegistration = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof AuthMethodRegistrationRequiredState)) {
            return;
        }

        if (!selectedMethod || !verificationContact) {
            setError("Please select an authentication method and enter a verification contact.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const details = {
                authMethodType: selectedMethod,
                verificationContact,
            };
            const result = await state.challengeAuthMethod(details);

            if (hasFailed(result)) {
                if (result.error?.isInvalidInput()) {
                    setError(result.error.errorData.errorDescription || "Incorrect verification contact.");
                } else if (result.error?.isVerificationContactBlocked()) {
                    setError(
                        result.error.errorData.errorDescription ||
                            "The verification contact is blocked. Use a different contact or authentication method.",
                    );
                } else {
                    setError(
                        result.error?.errorData.errorDescription ||
                            "An error occurred while adding the authentication method."
                    );
                }
                return;
            }

            setVerificationContact("");
            setRegistrationDetails(details);
            setResendCountdown(30);
            onStateChange(result.state);
            if (result.isCompleted()) {
                setChallenge("");
                onCompleted(result.data);
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleRegistrationResend = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof AuthMethodVerificationRequiredState) || !registrationDetails) {
            setError("Start over before requesting another verification code.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.challengeAuthMethod(registrationDetails);
            if (hasFailed(result)) {
                setError(
                    result.error?.errorData.errorDescription ||
                        "An error occurred while resending the verification code.",
                );
                return;
            }

            setChallenge("");
            setResendCountdown(30);
            onStateChange(result.state);
            if (result.isCompleted()) {
                onCompleted(result.data);
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleRegistrationChallenge = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof AuthMethodVerificationRequiredState)) {
            return;
        }

        if (!challenge) {
            setError("Please enter a code.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await state.submitChallenge(challenge);
            if (hasFailed(result)) {
                setError(
                    result.error?.errorData.errorDescription ||
                        (result.error?.isIncorrectChallenge()
                            ? "Incorrect code."
                            : "An error occurred while verifying the authentication method.")
                );
                return;
            }

            setChallenge("");
            onStateChange(result.state);
            onCompleted(result.data);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleMfaMethod = async () => {
        if (!(state instanceof MfaAwaitingState)) {
            return;
        }

        if (!selectedMethod) {
            setError("Please select an authentication method.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await state.requestChallenge(selectedMethod.id);
            if (hasFailed(result)) {
                setError(
                    result.error?.errorData.errorDescription ||
                        (result.error?.isInvalidInput()
                            ? "Incorrect verification contact."
                            : "An error occurred while requesting an MFA code.")
                );
                return;
            }

            setChallenge("");
            onStateChange(result.state);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleMfaChallenge = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof MfaVerificationRequiredState)) {
            return;
        }

        if (!challenge) {
            setError("Please enter a code.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await state.submitChallenge(challenge);
            if (hasFailed(result)) {
                setError(
                    result.error?.errorData.errorDescription ||
                        (result.error?.isIncorrectChallenge()
                            ? "Incorrect code."
                            : "An error occurred while verifying the MFA code.")
                );
                return;
            }

            setChallenge("");
            onStateChange(result.state);
            onCompleted(result.data);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const methods =
        state instanceof AuthMethodRegistrationRequiredState || state instanceof MfaAwaitingState
            ? state.getAuthMethods()
            : [];
    const getPlaceholderText = () => {
        const channel = selectedMethod?.challenge_channel?.toLowerCase();
        if (channel === "email") {
            return "Enter your email for verification";
        }
        if (channel === "sms" || channel === "phone") {
            return "Enter your phone number for verification";
        }
        return "Enter your contact information for verification";
    };

    return (
        <>
            {state instanceof AuthMethodRegistrationRequiredState && (
                <AuthMethodRegistrationForm
                    onSubmit={handleRegistration}
                    authMethods={methods}
                    selectedAuthMethod={selectedMethod}
                    setSelectedAuthMethod={setSelectedMethod}
                    verificationContact={verificationContact}
                    setVerificationContact={setVerificationContact}
                    loading={loading}
                    getPlaceholderText={getPlaceholderText}
                />
            )}
            {state instanceof AuthMethodVerificationRequiredState && (
                <CodeForm
                    onSubmit={handleRegistrationChallenge}
                    code={challenge}
                    setCode={setChallenge}
                    loading={loading}
                    onResendCode={handleRegistrationResend}
                    resendCountdown={resendCountdown}
                    sentTo={state.getSentTo()}
                    channel={state.getChannel()}
                    codeLength={state.getCodeLength()}
                    title="Enter the code below to verify your method"
                />
            )}
            {state instanceof MfaAwaitingState && (
                <MethodSelectionForm
                    onSubmit={handleMfaMethod}
                    onSelectionChange={(channel) =>
                        setSelectedMethod(methods.find((method) => method.challenge_channel === channel))
                    }
                    options={methods.map((method) => ({
                        value: method.challenge_channel,
                        label: `${method.challenge_channel}${method.login_hint ? ` (${method.login_hint})` : ""}`,
                    }))}
                    loading={loading}
                    title="Select a verification method to complete multi-factor (second factor) authentication"
                />
            )}
            {state instanceof MfaVerificationRequiredState && (
                <CodeForm
                    onSubmit={handleMfaChallenge}
                    code={challenge}
                    setCode={setChallenge}
                    loading={loading}
                    sentTo={state.getSentTo()}
                    channel={state.getChannel()}
                    codeLength={state.getCodeLength()}
                    title="Enter the code below to verify your selected authentication method"
                />
            )}
        </>
    );
}

export default V1MfaAndRegistrationFlow;
