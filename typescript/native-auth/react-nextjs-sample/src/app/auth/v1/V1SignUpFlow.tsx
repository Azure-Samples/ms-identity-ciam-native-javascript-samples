"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    AuthFlowStateBase,
    CustomAuthAccountData,
    SignUpAttributesRequiredState,
    SignUpCodeRequiredState,
    SignUpCompletedState,
    SignUpPasswordRequiredState,
    UserAccountAttributes,
} from "@azure/msal-browser/custom-auth";
import { AuthStepLayout } from "../components/AuthStepLayout";
import { AttributeField, DynamicAttributesForm } from "../components/forms/DynamicAttributesForm";
import { CodeForm } from "../components/forms/CodeForm";
import { PasswordForm } from "../components/forms/PasswordForm";
import type { AuthFlowProps, InitialCredentials } from "../types";
import { isV1MfaOrRegistrationState, V1MfaAndRegistrationFlow } from "./V1MfaAndRegistrationFlow";

type V1SignUpFlowProps = Omit<Extract<AuthFlowProps, { version: "v1"; action: "signUp" }>, "version" | "action">;

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function hasFailed(result: { isFailed(): boolean }): boolean {
    return result.isFailed();
}

function getAttributeLabel(name: string): string {
    const readableName = name
        .replace(/^extension_[^_]+_/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ");
    return readableName.charAt(0).toUpperCase() + readableName.slice(1);
}

export function startV1SignUp(app: AuthFlowProps["app"], credentials: InitialCredentials) {
    return app.signUp({
        username: credentials.username,
        ...(credentials.password ? { password: credentials.password } : {}),
    });
}

export function V1SignUpFlow({ initialResult, onCancel, onCompleted }: V1SignUpFlowProps) {
    const handledInitialResult = useRef(false);
    const [state, setState] = useState<AuthFlowStateBase | null>(null);
    const [code, setCode] = useState("");
    const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
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
            setAttributeValues({});
            onCompleted(account);
        },
        [onCompleted],
    );

    const handleCancel = () => {
        setCode("");
        setAttributeValues({});
        onCancel();
    };

    const handleAutoSignIn = async (completedState: SignUpCompletedState) => {
        setError("");
        setLoading(true);

        try {
            const result = await completedState.signIn();
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
        setAttributeValues({});
        setError("");
        setLoading(true);
        setResendCountdown(0);

        const consumeInitialResult = async () => {
            try {
                if (hasFailed(initialResult)) {
                    if (initialResult.error?.isUserAlreadyExists()) {
                        setError(
                            initialResult.error.errorData.errorDescription ||
                                "An account with this email or username already exists.",
                        );
                    } else if (initialResult.error?.isInvalidUsername()) {
                        setError(initialResult.error.errorData.errorDescription || "Username is invalid.");
                    } else if (initialResult.error?.isInvalidPassword()) {
                        setError(initialResult.error.errorData.errorDescription || "Password is invalid.");
                    } else if (initialResult.error?.isAttributesValidationFailed()) {
                        setError(
                            initialResult.error.errorData.errorDescription ||
                                "One or more account attributes are invalid.",
                        );
                    } else if (initialResult.error?.isMissingRequiredAttributes()) {
                        setError(
                            initialResult.error.errorData.errorDescription ||
                                "Required account attributes are missing.",
                        );
                    } else {
                        setError(
                            initialResult.error?.errorData.errorDescription || "An error occurred while signing up.",
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
        if (!(state instanceof SignUpCodeRequiredState)) {
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
            if (result.isCompleted()) {
                await handleAutoSignIn(result.state);
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof SignUpCodeRequiredState)) {
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

    const handlePasswordSubmit = async (password: string) => {
        if (!(state instanceof SignUpPasswordRequiredState)) {
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
                            ? "Invalid password."
                            : "An error occurred while submitting the password."),
                );
                return;
            }

            setState(result.state);
            if (result.isCompleted()) {
                await handleAutoSignIn(result.state);
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleAttributesSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(state instanceof SignUpAttributesRequiredState)) {
            setError("Start over before submitting account attributes.");
            return;
        }

        const requiredAttributes = state.getRequiredAttributes();
        const missingAttribute = requiredAttributes.find(
            (attribute) => attribute.required !== false && !attributeValues[attribute.name]?.trim(),
        );
        if (missingAttribute) {
            setError(`${getAttributeLabel(missingAttribute.name)} is required.`);
            return;
        }

        const attributes: UserAccountAttributes = {};
        for (const attribute of requiredAttributes) {
            const value = attributeValues[attribute.name];
            if (value) {
                attributes[attribute.name] = value;
            }
        }

        setError("");
        setLoading(true);
        try {
            const result = await state.submitAttributes(attributes);
            if (hasFailed(result)) {
                if (result.error?.isMissingRequiredAttributes()) {
                    setError(result.error.errorData.errorDescription || "Required account attributes are missing.");
                } else if (result.error?.isAttributesValidationFailed()) {
                    setError(result.error.errorData.errorDescription || "One or more account attributes are invalid.");
                } else {
                    setError(
                        result.error?.errorData.errorDescription ||
                            "An error occurred while submitting account attributes.",
                    );
                }
                return;
            }

            setAttributeValues({});
            setState(result.state);
            if (result.isCompleted()) {
                await handleAutoSignIn(result.state);
            } else {
                setError("Submitting account attributes returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const requiredAttributes = state instanceof SignUpAttributesRequiredState ? state.getRequiredAttributes() : [];
    const attributeFields: AttributeField[] = requiredAttributes.map((attribute) => ({
        name: attribute.name,
        label: getAttributeLabel(attribute.name),
        required: attribute.required !== false,
        inputType: attribute.type?.toLowerCase() === "password" ? "password" : "text",
        pattern: attribute.options?.regex,
    }));

    let content: React.ReactNode;
    if (state instanceof SignUpCodeRequiredState) {
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
    } else if (state instanceof SignUpPasswordRequiredState) {
        content = <PasswordForm onSubmit={handlePasswordSubmit} loading={loading} />;
    } else if (state instanceof SignUpAttributesRequiredState) {
        content = (
            <DynamicAttributesForm
                fields={attributeFields}
                values={attributeValues}
                onChange={(name, value) => setAttributeValues((current) => ({ ...current, [name]: value }))}
                onSubmit={handleAttributesSubmit}
                loading={loading}
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
    } else if (state instanceof SignUpCompletedState) {
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
        content = <p className="auth-helper-text">{loading ? "Starting sign up..." : "Unable to continue sign up."}</p>;
    }

    return (
        <AuthStepLayout
            title="V1 Sign Up"
            error={error ? `Error: ${error}` : ""}
            busy={loading || mfaOrRegistrationBusy}
            onCancel={handleCancel}
        >
            {content}
        </AuthStepLayout>
    );
}

export default V1SignUpFlow;
