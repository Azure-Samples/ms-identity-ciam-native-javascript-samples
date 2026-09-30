import { type FormEvent, useRef } from "react";
import type { AuthStartRequest, AuthVersion } from "../../types";
import { SocialProviderButtons } from "../SocialProviderButtons";

interface AuthStartFormProps {
    version: AuthVersion;
    username: string;
    error: string;
    loading: boolean;
    onVersionChange: (version: AuthVersion) => void;
    onUsernameChange: (username: string) => void;
    onStart: (request: AuthStartRequest) => Promise<void>;
    onSocialSelect: (domainHint: string) => Promise<void>;
}

export function AuthStartForm({
    version,
    username,
    error,
    loading,
    onVersionChange,
    onUsernameChange,
    onStart,
    onSocialSelect,
}: AuthStartFormProps) {
    const passwordInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-auth-action");
        if (action !== "signIn" && action !== "signUp" && action !== "resetPassword") {
            throw new Error("The authentication form was submitted without a valid action.");
        }

        const password = action === "resetPassword" ? undefined : passwordInputRef.current?.value || undefined;
        const request = onStart({ action, username, password });
        if (passwordInputRef.current) {
            passwordInputRef.current.value = "";
        }
        void request;
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="auth-form"
        >
            <div className="auth-toggle" role="group" aria-label="Native authentication version">
                {(["v1", "v2"] as const).map((option) => (
                    <button
                        key={option}
                        type="button"
                        aria-pressed={version === option}
                        className={version === option ? "auth-button" : "auth-secondary-button"}
                        onClick={() => onVersionChange(option)}
                        disabled={loading}
                    >
                        {option.toUpperCase()}
                    </button>
                ))}
            </div>
            <input
                type="text"
                name="username"
                placeholder="Email or Username"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                className="auth-input"
                required
            />
            <input
                ref={passwordInputRef}
                type="password"
                name="password"
                placeholder="Password (optional)"
                autoComplete="current-password"
                className="auth-input"
            />
            <p className="auth-helper-text">
                Password is optional for Sign In and Sign Up. Reset Password uses only the email address.
            </p>
            <div className="auth-actions">
                <button
                    type="submit"
                    data-auth-action="signIn"
                    className="auth-button"
                    disabled={loading}
                >
                    Sign In
                </button>
                <button
                    type="submit"
                    data-auth-action="signUp"
                    className="auth-button"
                    disabled={loading}
                >
                    Sign Up
                </button>
                <button
                    type="submit"
                    data-auth-action="resetPassword"
                    className="auth-button"
                    disabled={loading}
                >
                    Reset Password
                </button>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <SocialProviderButtons onSelect={onSocialSelect} loading={loading} />
        </form>
    );
}
