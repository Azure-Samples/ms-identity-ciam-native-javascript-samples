interface UserInfoProps {
    signInState: any;
}

export function UserInfo({ signInState }: UserInfoProps) {
    return (
        <div
            style={{
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                marginTop: "20px",
            }}
        >
            <h3>Sign In Successful</h3>
            <pre
                style={{
                    background: "#f5f5f5",
                    padding: "15px",
                    borderRadius: "4px",
                    overflowX: "auto",
                }}
            >
                {JSON.stringify(signInState, null, 2)}
            </pre>
        </div>
    );
}
