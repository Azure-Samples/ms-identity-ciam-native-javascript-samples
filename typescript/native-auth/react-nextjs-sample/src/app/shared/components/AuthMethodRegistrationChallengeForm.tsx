import React from "react";
import type { AuthMethodRegistrationChallengeFormProps } from "../types/formProperties";

export const AuthMethodRegistrationChallengeForm: React.FC<AuthMethodRegistrationChallengeFormProps> = ({
    onSubmit,
    challenge,
    setChallenge,
    loading,
    styles,
    title = "Enter the code below to verify your method",
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
                <input
                    type="text"
                    value={challenge}
                    onChange={(e) => setChallenge(e.target.value)}
                    placeholder="Enter verification code"
                    style={styles.input}
                    required
                />
                <button
                    type="submit"
                    disabled={loading || !challenge}
                    style={loading || !challenge ? styles.buttonDisabled : styles.button}
                >
                    {loading ? "Verifying..." : "Verify Code"}
                </button>
            </form>
        </div>
    );
};
