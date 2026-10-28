import type { PasswordFormProps } from "../types/formProperties";

export function PasswordForm({
    onSubmit,
    password,
    setPassword,
    loading,
    submitButtonText = "Submit Password",
    submitButtonLoadingText = "Submitting...",
}: PasswordFormProps) {
    const formStyles = {
        form: { display: "flex" as const, flexDirection: "column" as const, gap: "15px" },
        input: {
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "16px",
        },
        button: {
            padding: "10px",
            backgroundColor: "#0078d4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
        },
    };

    return (
        <form onSubmit={onSubmit} style={formStyles.form}>
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={formStyles.input}
                required
            />
            <button type="submit" style={formStyles.button} disabled={loading}>
                {loading ? submitButtonLoadingText : submitButtonText}
            </button>
        </form>
    );
}
