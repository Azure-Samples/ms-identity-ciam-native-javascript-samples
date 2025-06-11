import { useRouter } from "next/navigation";

export function ResetPasswordResultPage() {
    const router = useRouter();

    return (
        <div
            style={{
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                marginTop: "20px",
            }}
        >
            <div>Password Reset Successful</div>

            <div style={{ marginTop: "20px" }}>
                <button
                    style={{
                        padding: "10px",
                        backgroundColor: "#0078d4",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "16px",
                    }}
                    onClick={() => router.push("/sign-in")}
                >
                    Go to Sign In
                </button>
            </div>
        </div>
    );
}
