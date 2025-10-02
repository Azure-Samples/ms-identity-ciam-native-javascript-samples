import { styles } from "../styles/styles";
import type { ResetPasswordInitialFormProps } from "../types/formProperties";

export function InitialForm({ onSubmit, email, setEmail, loading }: ResetPasswordInitialFormProps) {
    return (
        <form onSubmit={onSubmit} style={styles.form}>
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
            />
            <button type="submit" style={styles.button} disabled={loading}>
                {loading ? "Sending..." : "Reset Password"}
            </button>
        </form>
    );
}
