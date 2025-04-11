import Link from "next/link";
import { useRouter } from "next/navigation";

interface SignUpResultProps {
    state: any;
}

export function SignUpResultPage({ state }: SignUpResultProps) {
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
            <h3>Sign Up Successful</h3>
            <details style={{ marginTop: "20px" }}>
                <summary style={{ cursor: "pointer", color: "#666" }}>Technical Details</summary>
                <pre
                    style={{
                        background: "#f5f5f5",
                        padding: "15px",
                        borderRadius: "4px",
                        overflowX: "auto",
                        marginTop: "10px",
                    }}
                >
                    {JSON.stringify(state, null, 2)}
                </pre>
            </details>
        </div>
    );
}