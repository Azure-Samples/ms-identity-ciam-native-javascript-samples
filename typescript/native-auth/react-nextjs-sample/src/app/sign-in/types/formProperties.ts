import { FormProps } from "@/app/shared/types/formProperties";
import { CustomAuthAccountData } from "@azure/msal-browser/custom-auth";

export interface SignInInitialFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    username: string;
    setUsername: (value: string) => void;
}

export interface UserInfoProps {
    userData: CustomAuthAccountData | undefined | null;
}
