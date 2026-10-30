interface AuthStepLayoutProps {
    title: string;
    error: string;
    busy: boolean;
    onCancel: () => void;
    children: React.ReactNode;
}

export function AuthStepLayout({ title, error, busy, onCancel, children }: AuthStepLayoutProps) {
    return (
        <div className="auth-container">
            <h2 className="auth-heading">{title}</h2>
            {children}
            {error && <div className="auth-error">{error}</div>}
            {error && (
                <button
                    type="button"
                    className="auth-secondary-button"
                    onClick={onCancel}
                    disabled={busy}
                >
                    Start over
                </button>
            )}
        </div>
    );
}
