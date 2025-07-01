export const styles = {
    container: {
        maxWidth: "400px",
        margin: "40px auto",
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "8px",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "15px",
    },
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
    error: {
        color: "#d13438",
        marginTop: "10px",
    },
    h2: {
        margin: "0 0 10px 0",
    },
    signed_in_msg: {
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        marginTop: "20px",
    }
} as const;
