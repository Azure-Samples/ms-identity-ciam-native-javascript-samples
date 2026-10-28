import { styles } from "../styles/styles";
import type { NewPasswordFormProps } from "../types/formProperties";

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
