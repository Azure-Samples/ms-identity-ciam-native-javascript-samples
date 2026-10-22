interface PasswordFormProps {
    loading: boolean;
    onSubmit: (password: string) => Promise<void>;
    noValidate?: boolean;
    passwordLabel?: string;
    passwordPattern?: string;
    passwordError?: string;
    onPasswordChange?: () => void;
    submitButtonText?: string;
    submitButtonLoadingText?: string;
    children?: React.ReactNode;
}

export function PasswordForm({
    onSubmit,
    noValidate = false,
    loading,
    passwordLabel = "Password",
    passwordPattern,
    passwordError,
    onPasswordChange,
    submitButtonText = "Submit Password",
    submitButtonLoadingText = "Submitting...",
    children,
}: PasswordFormProps) {
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const password = String(new FormData(form).get("password") ?? "");
        form.reset();
        await onSubmit(password);
    };

    const formStyles = {
        form: { display: "flex" as const, flexDirection: "column" as const, gap: "15px" },
        input: {
            padding: "8px",
            border: passwordError ? "1px solid #d13438" : "1px solid #ccc",
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
        <form onSubmit={handleSubmit} style={formStyles.form} noValidate={noValidate}>
            <label htmlFor="auth-password">
                {passwordLabel} *
                <input
                    id="auth-password"
                    type="password"
                    name="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    pattern={passwordPattern}
                    style={formStyles.input}
                    onChange={onPasswordChange}
                    aria-invalid={passwordError ? true : undefined}
                    aria-describedby={passwordError ? "auth-password-error" : undefined}
                    required
                />
                {passwordError && (
                    <span id="auth-password-error" className="auth-field-error" role="alert">
                        {passwordError}
                    </span>
                )}
            </label>
            {children}
            <button type="submit" style={formStyles.button} disabled={loading}>
                {loading ? submitButtonLoadingText : submitButtonText}
            </button>
        </form>
    );
}
