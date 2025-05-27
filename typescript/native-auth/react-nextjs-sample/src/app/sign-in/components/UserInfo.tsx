import { CustomAuthAccountData } from "@azure/msal-custom-auth";

interface UserInfoProps {
    userData: CustomAuthAccountData | undefined | null | unknown;
}

export function UserInfo({ userData }: UserInfoProps) {
    return (
        <div
            style={{
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                marginTop: "20px",
            }}
        >
            {`The user ${userData?.getAccount().username} has been signed in`}
        </div>
    );
}
