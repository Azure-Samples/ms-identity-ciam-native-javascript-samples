import { styles } from "../styles/styles";
import type { ResetPasswordInitialFormProps } from "../types/formProperties";

export function InitialForm({ onSubmit, username, setUsername, loading }: ResetPasswordInitialFormProps) {
    return (
        <form onSubmit={onSubmit} style={styles.form}>
            <input
                type="text"
                placeholder="Email or Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
            />
            <button type="submit" style={styles.button} disabled={loading}>
                {loading ? "Sending..." : "Reset Password"}
            </button>
        </form>
    );
}
