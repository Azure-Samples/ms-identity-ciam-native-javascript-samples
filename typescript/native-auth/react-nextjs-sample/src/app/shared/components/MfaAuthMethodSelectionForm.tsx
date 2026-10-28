import React from "react";
import type { MfaAuthMethodSelectionFormProps } from "../types/formProperties";

export const MfaAuthMethodSelectionForm: React.FC<MfaAuthMethodSelectionFormProps> = ({
    onSubmit,
    authMethods,
    selectedAuthMethod,
    setSelectedAuthMethod,
    loading,
    styles,
    title = "Select a verification method to complete multi-factor (second factor) authentication",
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
                        const selected = authMethods.find((method) => method.challenge_channel === e.target.value);
                        setSelectedAuthMethod(selected);
                    }}
                    style={{ ...styles.input, textTransform: "capitalize" as const }}
                    required
                >
                    {authMethods.map((method) => (
                        <option key={method.challenge_channel} value={method.challenge_channel}>
                            {method.challenge_channel}
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    disabled={loading || !selectedAuthMethod}
                    style={loading || !selectedAuthMethod ? styles.buttonDisabled : styles.button}
                >
                    {loading ? "Loading..." : "Choose"}
                </button>
            </form>
        </div>
    );
};
