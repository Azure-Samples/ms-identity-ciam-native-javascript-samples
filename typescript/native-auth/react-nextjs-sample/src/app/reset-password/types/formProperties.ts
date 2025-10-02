import { FormProps } from "@/app/shared/types/formProperties";

export interface ResetPasswordInitialFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    email: string;
    setEmail: (value: string) => void;
}

export interface NewPasswordFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    newPassword: string;
    setNewPassword: (value: string) => void;
}
