"use client";

import { useEffect, useState } from "react";
import {
    AttributesRequiredStateV2,
    AuthFlowStateBase,
    CodeRequiredStateV2,
    CompletedStateV2,
    CustomAuthApiError,
    CustomAuthAccountData,
    CustomAuthPublicClientApplication,
    ICustomAuthPublicClientApplicationV2,
    SignInContinuationStateV2,
    SignUpPasswordRequiredStateV2,
    UserAccountAttributes,
} from "@azure/msal-browser/custom-auth";
import { customAuthConfig } from "../../config/auth-config";
import { ChallengeFormV2 } from "../shared/v2/components/ChallengeFormV2";
import { ForceRefreshToken } from "../shared/components/ForceRefreshToken";
import { PasswordForm } from "../shared/components/PasswordForm";
import { UserInfo } from "../sign-in/components/UserInfo";
import { styles } from "../sign-up/styles/styles";

type AttributeValues = Record<string, string>;

const getAttributeValidationMessage = (errorData: unknown): string | undefined => {
    if (!(errorData instanceof CustomAuthApiError)) {
        return undefined;
    }

    const messages = errorData.attributeValidationDetails
        ?.map((detail) => {
            const message = detail.message || detail.code;
            if (!message) {
                return undefined;
            }

            const attributes = detail.attributeIds?.join(", ");
            return attributes ? `${attributes}: ${message}` : message;
        })
        .filter((message): message is string => Boolean(message));

    return messages?.length ? messages.join(" ") : undefined;
};

export default function SignUpV2() {
    const [app, setApp] = useState<ICustomAuthPublicClientApplicationV2 | null>(null);
    const [loadingAccountStatus, setLoadingAccountStatus] = useState(true);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [givenName, setGivenName] = useState("");
    const [surname, setSurname] = useState("");
    const [usernameAlias, setUsernameAlias] = useState("");
    const [attributeValues, setAttributeValues] = useState<AttributeValues>({});
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [signUpState, setSignUpState] = useState<AuthFlowStateBase | null>(null);
    const [data, setData] = useState<CustomAuthAccountData | undefined>();

    useEffect(() => {
        const initializeApp = async () => {
            const appInstance = await CustomAuthPublicClientApplication.create(customAuthConfig);
            setApp(appInstance);
        };

        initializeApp();
    }, []);

    useEffect(() => {
        if (!app) {
            return;
        }

        const accountResult = app.getCurrentAccount();
        if (accountResult.isCompleted()) {
            setData(accountResult.data);
            setIsSignedIn(true);
        }

        setLoadingAccountStatus(false);
    }, [app]);

    useEffect(() => {
        if (resendCountdown <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setResendCountdown((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCountdown]);

    const setFailedResult = (fallback: string, description?: string) => {
        setError(description || fallback);
    };

    const handleContinuation = async (continuationState: SignInContinuationStateV2) => {
        setSignUpState(continuationState);
        const result = await continuationState.signIn({ scopes: [] });

        if (result.isFailed()) {
            if (result.error?.isBrowserRequired()) {
                setError("Sign-in must be completed in a browser.");
            } else {
                setFailedResult("Sign-up completed, but automatic sign-in failed.", result.error?.errorDescription);
            }
            return;
        }

        if (result.isState("completed")) {
            setSignUpState(result.state);
            setData(result.data);
            setIsSignedIn(true);
            setPassword("");
            return;
        }

        setError("Sign-in after sign-up returned an unsupported state.");
    };

    const handleInitialSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!app) {
            return;
        }

        setError("");
        setLoading(true);

        try {
            const attributes: UserAccountAttributes = {
                ...(givenName && { givenName }),
                ...(surname && { surname }),
                ...(givenName || surname ? { displayName: `${givenName} ${surname}`.trim() } : {}),
                ...(usernameAlias && { username: usernameAlias }),
            };
            const result = await app.signUpV2({
                username,
                ...(password ? { password } : {}),
                attributes,
                scopes: [],
            });

            if (result.isFailed()) {
                const attributeValidationMessage = getAttributeValidationMessage(result.error?.errorData);
                if (attributeValidationMessage) {
                    setError(attributeValidationMessage);
                } else if (result.error?.isInvalidInput()) {
                    setError("Enter a valid username and attributes.");
                } else if (result.error?.isBrowserRequired()) {
                    setError("Sign-up must be completed in a browser.");
                } else {
                    setFailedResult("An error occurred while starting sign-up.", result.error?.errorDescription);
                }
                return;
            }

            setAttributeValues({});
            setCode("");
            setSignUpState(result.state);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (event: React.FormEvent) => {
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
                if (result.error?.isInvalidCode()) {
                    setError("The verification code is invalid or expired.");
                } else if (result.error?.isInvalidInput()) {
                    setError("Enter the complete verification code.");
                } else {
                    setFailedResult("An error occurred while verifying the code.", result.error?.errorDescription);
                }
                return;
            }

            setAttributeValues({});
            setSignUpState(result.state);
            if (result.state instanceof SignInContinuationStateV2) {
                await handleContinuation(result.state);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(signUpState instanceof CodeRequiredStateV2)) {
            return;
        }

        setError("");
        setResendLoading(true);

        try {
            const result = await signUpState.resendCode();
            if (result.isFailed()) {
                setFailedResult("An error occurred while resending the code.", result.error?.errorDescription);
                return;
            }

            setCode("");
            setResendCountdown(30);
            setSignUpState(result.state);
        } finally {
            setResendLoading(false);
        }
    };

    const handleAttributesSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(signUpState instanceof AttributesRequiredStateV2)) {
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await signUpState.submitAttributes(attributeValues);
            if (result.isFailed()) {
                const attributeValidationMessage = getAttributeValidationMessage(result.error?.errorData);
                if (attributeValidationMessage) {
                    setError(attributeValidationMessage);
                } else if (result.error?.isMissingRequiredAttributes()) {
                    setError("One or more required attributes are missing or invalid.");
                } else {
                    setFailedResult("An error occurred while submitting attributes.", result.error?.errorDescription);
                }
                return;
            }

            setCode("");
            setSignUpState(result.state);
            if (result.state instanceof SignInContinuationStateV2) {
                await handleContinuation(result.state);
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!(signUpState instanceof SignUpPasswordRequiredStateV2)) {
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await signUpState.submitPassword(password, attributeValues);
            if (result.isFailed()) {
                const attributeValidationMessage = getAttributeValidationMessage(result.error?.errorData);
                if (attributeValidationMessage) {
                    setError(attributeValidationMessage);
                } else if (result.error?.isInvalidInput()) {
                    setError("Enter a password.");
                } else if (result.error?.isInvalidPassword()) {
                    setError("The password does not meet the requirements.");
                } else if (result.error?.isMissingRequiredAttributes()) {
                    setError("One or more required attributes are missing or invalid.");
                } else {
                    setFailedResult("An error occurred while submitting the password.", result.error?.errorDescription);
                }
                return;
            }

            setPassword("");
            setCode("");
            setSignUpState(result.state);
            if (result.state instanceof SignInContinuationStateV2) {
                await handleContinuation(result.state);
            }
        } finally {
            setLoading(false);
        }
    };

    const renderAttributeFields = (state: AttributesRequiredStateV2 | SignUpPasswordRequiredStateV2) =>
        state.attributes.map((attribute) => (
            <label key={attribute.attributeId}>
                {attribute.label || attribute.attributeId}
                {attribute.required ? " *" : " (optional)"}
                <input
                    type={attribute.inputType === "password" ? "password" : "text"}
                    value={attributeValues[attribute.attributeId] || ""}
                    onChange={(event) =>
                        setAttributeValues((current) => ({
                            ...current,
                            [attribute.attributeId]: event.target.value,
                        }))
                    }
                    pattern={attribute.regex}
                    required={attribute.required}
                    style={styles.input}
                />
            </label>
        ));

    const renderContent = () => {
        if (loadingAccountStatus) {
            return <div>Checking account status...</div>;
        }

        if (isSignedIn) {
            return data ? (
                <>
                    <UserInfo userData={data} />
                    <ForceRefreshToken accountData={data} />
                </>
            ) : (
                <div style={styles.signed_in_msg}>The user is signed in.</div>
            );
        }

        if (signUpState instanceof CodeRequiredStateV2) {
            return (
                <ChallengeFormV2
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
                />
            );
        }

        if (signUpState instanceof SignUpPasswordRequiredStateV2) {
            return (
                <PasswordForm
                    onSubmit={handlePasswordSubmit}
                    password={password}
                    setPassword={setPassword}
                    passwordLabel={signUpState.requiredPasswordAttribute.label || "Password"}
                    passwordPattern={signUpState.requiredPasswordAttribute.regex}
                    loading={loading}
                    submitButtonText="Submit password"
                    submitButtonLoadingText="Submitting..."
                >
                    {renderAttributeFields(signUpState)}
                </PasswordForm>
            );
        }

        if (signUpState instanceof AttributesRequiredStateV2) {
            return (
                <form onSubmit={handleAttributesSubmit} style={styles.form}>
                    <p>Complete the attributes configured for this tenant. Fields marked optional may be left empty.</p>
                    {renderAttributeFields(signUpState)}
                    <button type="submit" style={loading ? styles.buttonDisabled : styles.button} disabled={loading}>
                        {loading ? "Submitting..." : "Submit attributes"}
                    </button>
                </form>
            );
        }

        if (signUpState instanceof SignInContinuationStateV2) {
            return <div>Completing sign-in...</div>;
        }

        if (signUpState instanceof CompletedStateV2) {
            return <div style={styles.signed_in_msg}>Sign-up completed.</div>;
        }

        return (
            <form onSubmit={handleInitialSubmit} style={styles.form}>
                <input
                    type="email"
                    placeholder="Email"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    style={styles.input}
                />
                <input
                    type="password"
                    placeholder="Password (optional)"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    style={styles.input}
                />
                <input
                    type="text"
                    placeholder="First name (optional)"
                    value={givenName}
                    onChange={(event) => setGivenName(event.target.value)}
                    style={styles.input}
                />
                <input
                    type="text"
                    placeholder="Last name (optional)"
                    value={surname}
                    onChange={(event) => setSurname(event.target.value)}
                    style={styles.input}
                />
                <input
                    type="text"
                    placeholder="Username alias (email + password only)"
                    value={usernameAlias}
                    onChange={(event) => setUsernameAlias(event.target.value)}
                    style={styles.input}
                />
                <button type="submit" style={loading ? styles.buttonDisabled : styles.button} disabled={loading}>
                    {loading ? "Signing up..." : "Sign Up"}
                </button>
            </form>
        );
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.h2}>Sign Up (V2)</h2>
            {renderContent()}
            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
}
