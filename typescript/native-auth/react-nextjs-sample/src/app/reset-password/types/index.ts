import { AuthenticationMethod } from "@azure/msal-browser/custom-auth";

export interface FormProps {
    loading: boolean;
}

export interface CodeFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    code: string;
    setCode: (value: string) => void;
    onResendCode: (e: React.FormEvent) => Promise<void>;
    resendCountdown: number;
}

export interface InitialFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    email: string;
    setEmail: (value: string) => void;
}

export interface NewPasswordFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    newPassword: string;
    setNewPassword: (value: string) => void;
}

export interface AuthMethodFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    authMethods: AuthenticationMethod[];
    selectedAuthMethod: AuthenticationMethod | undefined;
    setSelectedAuthMethod: (method: AuthenticationMethod | undefined) => void;
    verificationContact: string;
    setVerificationContact: (contact: string) => void;
    getPlaceholderText: () => string;
    styles: Record<string, React.CSSProperties>;
}

export interface ChallengeFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    challenge: string;
    setChallenge: (challenge: string) => void;
    styles: Record<string, React.CSSProperties>;
}
