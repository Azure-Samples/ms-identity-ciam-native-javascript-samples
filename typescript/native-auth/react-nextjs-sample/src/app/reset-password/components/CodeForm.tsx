import { styles } from "../styles/styles";
import { CodeFormProps } from "../types";

export function CodeForm({ onSubmit, code, setCode, loading, onResendCode, resendCountdown }: CodeFormProps) {
    return (
        <form onSubmit={onSubmit} style={styles.form}>
            <input
                type="text"
                placeholder="Enter verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={styles.input}
                required
            />
            <button type="submit" style={styles.button} disabled={loading}>
                {loading ? "Verifying..." : "Verify Code"}
            </button>
            <button
                type="button"
                style={resendCountdown > 0 ? styles.buttonDisabled : styles.button}
                onClick={onResendCode}
                disabled={resendCountdown > 0}
            >
                {resendCountdown > 0 ? `Resend Code (${resendCountdown}s)` : "Resend Code"}
            </button>
        </form>
    );
}
