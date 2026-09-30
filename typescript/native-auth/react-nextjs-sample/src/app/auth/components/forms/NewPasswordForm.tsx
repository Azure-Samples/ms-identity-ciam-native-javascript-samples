interface NewPasswordFormProps {
    loading: boolean;
    onSubmit: (password: string) => Promise<void>;
    noValidate?: boolean;
}

export function NewPasswordForm({
    onSubmit,
    loading,
    noValidate = false,
}: NewPasswordFormProps) {
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const password = String(new FormData(form).get("password") ?? "");
        form.reset();
        await onSubmit(password);
    };

    return (
        <form onSubmit={handleSubmit} className="auth-form" noValidate={noValidate}>
            <input
                type="password"
                name="password"
                placeholder="Enter new password"
                autoComplete="new-password"
                className="auth-input"
                required
            />
            <button type="submit" className="auth-button" disabled={loading}>
                {loading ? "Setting password..." : "Set New Password"}
            </button>
        </form>
    );
}
