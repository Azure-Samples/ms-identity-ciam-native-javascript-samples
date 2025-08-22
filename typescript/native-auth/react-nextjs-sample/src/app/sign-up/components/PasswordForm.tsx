import { styles } from "../styles/styles";
import { PasswordFormProps } from "../types";

export const PasswordForm = ({ onSubmit, password, setPassword, loading }: PasswordFormProps) => (
    <form onSubmit={onSubmit} style={styles.form}>
        <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
        />
        <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Submitting..." : "Submit Password"}
        </button>
    </form>
);
