"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
    AttributesRequiredStateV2,
    AuthFlowStateBase,
    CodeRequiredStateV2,
    CompletedStateV2,
    SignInContinuationStateV2,
    SignUpPasswordRequiredStateV2,
} from "@azure/msal-browser/custom-auth";
import type { CustomAuthAccountData, UserAccountAttributes } from "@azure/msal-browser/custom-auth";
import {
    DynamicAttributeFields,
    DynamicAttributesForm,
} from "../components/forms/DynamicAttributesForm";
import type { AttributeField } from "../components/forms/DynamicAttributesForm";
import { AuthStepLayout } from "../components/AuthStepLayout";
import type { AuthFlowProps, InitialCredentials } from "../types";
import { PasswordForm } from "../components/forms/PasswordForm";
import { CodeForm } from "../components/forms/CodeForm";
import { getV2ErrorMessage } from "./utils/getV2ErrorMessage";

type V2SignUpFlowProps = Omit<Extract<AuthFlowProps, { version: "v2"; action: "signUp" }>, "version" | "action">;
type AttributeValues = Record<string, string>;

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected sign-up error occurred.";
}

function getAttributeFields(
    state: AttributesRequiredStateV2 | SignUpPasswordRequiredStateV2,
): AttributeField[] {
    return state.attributes.map((attribute) => ({
        name: attribute.attributeId,
        label: attribute.label || attribute.attributeId,
        required: attribute.required === true,
        inputType: attribute.inputType === "password" ? "password" : "text",
        pattern: attribute.regex,
    }));
}

function buildAttributes(values: Readonly<AttributeValues>): UserAccountAttributes {
    const attributes: UserAccountAttributes = {};
    for (const [name, value] of Object.entries(values)) {
        if (value) {
            attributes[name] = value;
        }
    }
    return attributes;
}

export function startV2SignUp(app: AuthFlowProps["app"], credentials: InitialCredentials) {
    return app.signUpV2({
        username: credentials.username,
        ...(credentials.password ? { password: credentials.password } : {}),
        attributes: {},
    });
}

export function V2SignUpFlow({
    initialResult,
    onCancel,
    onCompleted,
}: V2SignUpFlowProps) {
    const handledInitialResult = useRef(false);
    const onCompletedRef = useRef(onCompleted);
    const [attributeValues, setAttributeValues] = useState<AttributeValues>({});
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [signUpState, setSignUpState] = useState<AuthFlowStateBase | null>(null);

    useEffect(() => {
        onCompletedRef.current = onCompleted;
    }, [onCompleted]);

    useEffect(() => {
        if (handledInitialResult.current) {
            return;
        }

        handledInitialResult.current = true;
        setAttributeValues({});
        setCode("");
        setError("");
        setSignUpState(null);
        setResendCountdown(0);
        setLoading(true);

        if (initialResult.isFailed()) {
            setError(getV2ErrorMessage(initialResult.error));
        } else if (initialResult.isState("codeRequired")) {
            setSignUpState(initialResult.state);
        } else if (initialResult.isState("passwordRequired")) {
            setSignUpState(initialResult.state);
        } else if (initialResult.isState("attributesRequired")) {
            setSignUpState(initialResult.state);
        } else {
            setError("Sign-up returned an unsupported state.");
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
        setSignUpState(state);
        setCode("");
        setAttributeValues({});
        onCompletedRef.current(account);
    };

    const handleCancel = () => {
        setCode("");
        setAttributeValues({});
        onCancel();
    };

    const continueSignIn = async (continuationState: SignInContinuationStateV2) => {
        setSignUpState(continuationState);
        setError("");
        setLoading(true);
        try {
            const result = await continuationState.signIn();
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
            } else if (result.isState("completed")) {
                complete(result.state, result.data);
            } else {
                setError("Sign-in after sign-up returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!(signUpState instanceof CodeRequiredStateV2)) {
            setError("Restart sign-up before submitting a verification code.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await signUpState.submitCode(code);
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (result.isState("passwordRequired") || result.isState("attributesRequired")) {
                setCode("");
                setAttributeValues({});
                setSignUpState(result.state);
            } else if (result.isState("signInContinuation")) {
                setCode("");
                await continueSignIn(result.state);
            } else if (result.isState("completed")) {
                complete(result.state, result.data);
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
        if (!(signUpState instanceof CodeRequiredStateV2)) {
            setError("Restart sign-up before requesting another code.");
            return;
        }

        setError("");
        setResendLoading(true);
        try {
            const result = await signUpState.resendCode();
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            setCode("");
            setResendCountdown(30);
            setSignUpState(result.state);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setResendLoading(false);
        }
    };

    const handleAttributesSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!(signUpState instanceof AttributesRequiredStateV2)) {
            setError("Restart sign-up before submitting attributes.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await signUpState.submitAttributes(buildAttributes(attributeValues));
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (result.isState("codeRequired")) {
                setAttributeValues({});
                setCode("");
                setSignUpState(result.state);
            } else if (result.isState("signInContinuation")) {
                setAttributeValues({});
                await continueSignIn(result.state);
            } else {
                setError("Attribute submission returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (password: string) => {
        if (!(signUpState instanceof SignUpPasswordRequiredStateV2)) {
            setError("Restart sign-up before submitting a password.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const result = await signUpState.submitPassword(password, buildAttributes(attributeValues));
            if (result.isFailed()) {
                setError(getV2ErrorMessage(result.error));
                return;
            }

            if (result.isState("codeRequired")) {
                setAttributeValues({});
                setCode("");
                setSignUpState(result.state);
            } else if (result.isState("signInContinuation")) {
                setAttributeValues({});
                await continueSignIn(result.state);
            } else {
                setError("Password submission returned an unsupported state.");
            }
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    };

    const handleAttributeChange = (name: string, value: string) => {
        setAttributeValues((current) => ({ ...current, [name]: value }));
    };

    let content;
    if (signUpState instanceof CodeRequiredStateV2) {
        content = (
            <CodeForm
                onSubmit={handleCodeSubmit}
                code={code}
                setCode={setCode}
                loading={loading}
                onResendCode={handleResendCode}
                resendCountdown={resendCountdown}
                resendLoading={resendLoading}
                sentTo={signUpState.sentTo}
                channel={signUpState.channel}
                codeLength={signUpState.codeLength}
                showDeliveryHint
                noValidate
            />
        );
    } else if (signUpState instanceof SignUpPasswordRequiredStateV2) {
        content = (
            <PasswordForm
                onSubmit={handlePasswordSubmit}
                passwordLabel={signUpState.requiredPasswordAttribute.label || "Password"}
                passwordPattern={signUpState.requiredPasswordAttribute.regex}
                loading={loading}
                noValidate
            >
                <DynamicAttributeFields
                    fields={getAttributeFields(signUpState)}
                    values={attributeValues}
                    onChange={handleAttributeChange}
                />
            </PasswordForm>
        );
    } else if (signUpState instanceof AttributesRequiredStateV2) {
        content = (
            <DynamicAttributesForm
                fields={getAttributeFields(signUpState)}
                values={attributeValues}
                onChange={handleAttributeChange}
                onSubmit={handleAttributesSubmit}
                loading={loading}
                noValidate
            />
        );
    } else if (signUpState instanceof SignInContinuationStateV2) {
        content = loading ? (
            <p>Completing sign-in...</p>
        ) : (
            <button type="button" className="auth-button" onClick={() => void continueSignIn(signUpState)}>
                Retry sign-in
            </button>
        );
    } else if (signUpState instanceof CompletedStateV2) {
        content = <div className="auth-signed-in-message">Sign-up completed.</div>;
    } else {
        content = loading ? <p>Starting sign-up...</p> : null;
    }

    return (
        <AuthStepLayout
            title="V2 Sign Up"
            error={error}
            busy={loading || resendLoading}
            onCancel={handleCancel}
        >
            {content}
        </AuthStepLayout>
    );
}

export default V2SignUpFlow;
