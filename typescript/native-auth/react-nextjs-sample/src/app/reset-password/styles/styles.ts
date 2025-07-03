export const styles = {
    container: {
        maxWidth: "400px",
        margin: "40px auto",
        padding: "20px",
        boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        borderRadius: "5px",
    },
    form: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "15px",
    },
    input: {
        padding: "10px",
        borderRadius: "4px",
        border: "1px solid #ddd",
        fontSize: "16px",
    },
    button: {
        padding: "12px",
        backgroundColor: "#0078d4",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "16px",
    },
    buttonDisabled: {
        padding: "12px",
        backgroundColor: "#6b7280",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "not-allowed",
        fontSize: "16px",
    },
    error: {
        color: "#d93025",
        marginTop: "10px",
        fontSize: "14px",
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
