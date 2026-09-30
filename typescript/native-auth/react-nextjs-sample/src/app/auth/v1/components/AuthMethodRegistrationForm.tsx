import React from "react";
import { AuthenticationMethod } from "@azure/msal-browser/custom-auth";

interface AuthMethodRegistrationFormProps {
    loading: boolean;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    authMethods: AuthenticationMethod[];
    selectedAuthMethod: AuthenticationMethod | undefined;
    setSelectedAuthMethod: (method: AuthenticationMethod | undefined) => void;
    verificationContact: string;
    setVerificationContact: (contact: string) => void;
    getPlaceholderText: () => string;
    title?: string;
}

export const AuthMethodRegistrationForm: React.FC<AuthMethodRegistrationFormProps> = ({
    onSubmit,
    authMethods,
    selectedAuthMethod,
    setSelectedAuthMethod,
    verificationContact,
    setVerificationContact,
    loading,
    getPlaceholderText,
    title = "To secure your account, please add an authentication method.",
}) => {
    return (
        <div>
            <h3
                style={{
                    marginBottom: "1rem",
                    color: "#374151",
                    fontSize: "1rem",
                    fontWeight: 500,
                    textAlign: "center",
                }}
            >
                {title}
            </h3>
            <form onSubmit={onSubmit} className="auth-form">
                <select
                    value={selectedAuthMethod?.challenge_channel || ""}
                    onChange={(e) => {
                        const selected = authMethods.find(
                            (method: AuthenticationMethod) => method.challenge_channel === e.target.value
                        );
                        setSelectedAuthMethod(selected);
                    }}
                    className="auth-input auth-capitalize"
                    required
                >
                    {authMethods.map((method: AuthenticationMethod) => (
                        <option key={method.challenge_channel} value={method.challenge_channel}>
                            {method.challenge_channel}
                        </option>
                    ))}
                </select>
                <input
                    type={
                        selectedAuthMethod?.challenge_channel === "email"
                            ? "email"
                            : selectedAuthMethod?.challenge_channel === "sms"
                            ? "tel"
                            : "text"
                    }
                    value={verificationContact}
                    onChange={(e) => setVerificationContact(e.target.value)}
                    placeholder={getPlaceholderText()}
                    className="auth-input"
                    required
                />
                <button
                    type="submit"
                    disabled={loading || !selectedAuthMethod || !verificationContact}
                    className={
                        loading || !selectedAuthMethod || !verificationContact
                            ? "auth-button-disabled"
                            : "auth-button"
                    }
                >
                    {loading ? "Adding..." : "Add"}
                </button>
            </form>
        </div>
    );
};
