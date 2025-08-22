import React from "react";
import { AuthMethodFormProps } from "../types";
import { AuthenticationMethod } from "@azure/msal-browser/custom-auth";

export const AuthMethodForm: React.FC<AuthMethodFormProps> = ({
    onSubmit,
    authMethods,
    selectedAuthMethod,
    setSelectedAuthMethod,
    verificationContact,
    setVerificationContact,
    loading,
    getPlaceholderText,
    styles,
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
                To secure your account, please add an authentication method.
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
                    type="email"
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
