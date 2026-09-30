interface CodeFormProps {
    loading: boolean;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    code: string;
    setCode: (value: string) => void;
    title?: string;
    sentTo?: string;
    channel?: string;
    codeLength?: number;
    showDeliveryHint?: boolean;
    noValidate?: boolean;
    onResendCode?: (e: React.FormEvent) => Promise<void>;
    resendCountdown?: number;
    resendLoading?: boolean;
    submitButtonText?: string;
    submitButtonLoadingText?: string;
}

export function CodeForm({
    onSubmit,
    code,
    setCode,
    title,
    sentTo,
    channel,
    codeLength,
    showDeliveryHint = false,
    noValidate = false,
    loading,
    onResendCode,
    resendCountdown = 0,
    resendLoading = false,
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
        <>
            {title && (
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
            )}
            {(showDeliveryHint || title || sentTo || channel || codeLength) && (
                <p>
                    A verification code was sent{sentTo ? ` to ${sentTo}` : ""}
                    {channel ? ` by ${channel}` : ""}.
                    {codeLength ? ` The code contains ${codeLength} characters.` : ""}
                </p>
            )}
            <form onSubmit={onSubmit} style={formStyles.form} noValidate={noValidate}>
                <input
                    type="text"
                    placeholder="Enter verification code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={formStyles.input}
                    required
                />
                <button
                    type="submit"
                    style={formStyles.button}
                    disabled={loading || resendLoading}
                >
                    {loading ? submitButtonLoadingText : submitButtonText}
                </button>
                {onResendCode && (
                    <button
                        type="button"
                        style={
                            resendCountdown > 0 || resendLoading || loading
                                ? formStyles.buttonDisabled
                                : formStyles.button
                        }
                        onClick={onResendCode}
                        disabled={resendCountdown > 0 || resendLoading || loading}
                    >
                        {resendLoading
                            ? "Resending..."
                            : resendCountdown > 0
                              ? `Resend Code (${resendCountdown}s)`
                              : "Resend Code"}
                    </button>
                )}
            </form>
        </>
    );
}
