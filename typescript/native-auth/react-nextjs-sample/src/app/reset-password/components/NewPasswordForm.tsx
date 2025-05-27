import { styles } from "../styles/styles";

interface NewPasswordFormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    newPassword: string;
    setNewPassword: (value: string) => void;
    loading: boolean;
}

export function NewPasswordForm({ onSubmit, newPassword, setNewPassword, loading }: NewPasswordFormProps) {
    return (
        <form onSubmit={onSubmit} style={styles.form}>
            <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
                required
            />
            <button type="submit" style={styles.button} disabled={loading}>
                {loading ? "Setting password..." : "Set New Password"}
            </button>
        </form>
    );
}
