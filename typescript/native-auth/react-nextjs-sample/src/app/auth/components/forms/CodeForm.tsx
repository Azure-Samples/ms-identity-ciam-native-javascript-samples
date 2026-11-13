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
    placeholder?: string;
    useAuthStyles?: boolean;
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
    placeholder = "Enter verification code",
    useAuthStyles = false,
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
            <form
                onSubmit={onSubmit}
                className={useAuthStyles ? "auth-form" : undefined}
                style={useAuthStyles ? undefined : formStyles.form}
                noValidate={noValidate}
            >
                <input
                    type="text"
                    placeholder={placeholder}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={useAuthStyles ? "auth-input" : undefined}
                    style={useAuthStyles ? undefined : formStyles.input}
                    required
                />
                <button
                    type="submit"
                    className={useAuthStyles ? "auth-button" : undefined}
                    style={useAuthStyles ? undefined : formStyles.button}
                    disabled={loading || resendLoading}
                >
                    {loading ? submitButtonLoadingText : submitButtonText}
                </button>
                {onResendCode && (
                    <button
                        type="button"
                        className={
                            useAuthStyles
                                ? resendCountdown > 0 || resendLoading || loading
                                    ? "auth-button-disabled"
                                    : "auth-button"
                                : undefined
                        }
                        style={
                            useAuthStyles
                                ? undefined
                                : resendCountdown > 0 || resendLoading || loading
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
