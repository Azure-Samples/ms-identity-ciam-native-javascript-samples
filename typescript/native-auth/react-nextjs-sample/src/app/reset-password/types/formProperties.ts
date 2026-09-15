import { FormProps } from "@/app/shared/types/formProperties";

export interface ResetPasswordInitialFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    username: string;
    setUsername: (value: string) => void;
    noValidate?: boolean;
}

export interface NewPasswordFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    newPassword: string;
    setNewPassword: (value: string) => void;
    noValidate?: boolean;
}
