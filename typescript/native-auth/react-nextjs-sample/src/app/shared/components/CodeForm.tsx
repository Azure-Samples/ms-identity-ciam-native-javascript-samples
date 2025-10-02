import type { CodeFormProps } from "../types/formProperties";

export function CodeForm({
    onSubmit,
    code,
    setCode,
    loading,
    onResendCode,
    resendCountdown,
    submitButtonText = "Verify Code",
    submitButtonLoadingText = "Verifying...",
}: CodeFormProps) {
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
        buttonDisabled: {
            padding: "10px",
            backgroundColor: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "not-allowed",
            fontSize: "16px",
        },
    };

    return (
        <form onSubmit={onSubmit} style={formStyles.form}>
            <input
                type="text"
                placeholder="Enter verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={formStyles.input}
                required
            />
            <button type="submit" style={formStyles.button} disabled={loading}>
                {loading ? submitButtonLoadingText : submitButtonText}
            </button>
            <button
                type="button"
                style={resendCountdown > 0 ? formStyles.buttonDisabled : formStyles.button}
                onClick={onResendCode}
                disabled={resendCountdown > 0}
            >
                {resendCountdown > 0 ? `Resend Code (${resendCountdown}s)` : "Resend Code"}
            </button>
        </form>
    );
}
