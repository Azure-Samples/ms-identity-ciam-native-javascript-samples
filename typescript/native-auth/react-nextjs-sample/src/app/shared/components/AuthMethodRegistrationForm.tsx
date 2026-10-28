import React from "react";
import type { AuthMethodRegistrationFormProps } from "../types/formProperties";
import { AuthenticationMethod } from "@azure/msal-browser/custom-auth";

export const AuthMethodRegistrationForm: React.FC<AuthMethodRegistrationFormProps> = ({
    onSubmit,
    authMethods,
    selectedAuthMethod,
    setSelectedAuthMethod,
    verificationContact,
    setVerificationContact,
    loading,
    getPlaceholderText,
    styles,
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
            <form onSubmit={onSubmit} style={styles.form}>
                <select
                    value={selectedAuthMethod?.challenge_channel || ""}
                    onChange={(e) => {
                        const selected = authMethods.find(
                            (method: AuthenticationMethod) => method.challenge_channel === e.target.value
                        );
                        setSelectedAuthMethod(selected);
                    }}
                    style={{ ...styles.input, textTransform: "capitalize" as const }}
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
                    style={styles.input}
                    required
                />
                <button
                    type="submit"
                    disabled={loading || !selectedAuthMethod || !verificationContact}
                    style={
                        loading || !selectedAuthMethod || !verificationContact ? styles.buttonDisabled : styles.button
                    }
                >
                    {loading ? "Adding..." : "Add"}
                </button>
            </form>
        </div>
    );
};
