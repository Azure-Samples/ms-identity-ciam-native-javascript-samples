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
    submitButtonText?: string;
    submitButtonLoadingText?: string;
}

export interface PasswordFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    password: string;
    setPassword: (value: string) => void;
    submitButtonText?: string;
    submitButtonLoadingText?: string;
}

export interface AuthMethodRegistrationFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    authMethods: AuthenticationMethod[];
    selectedAuthMethod: AuthenticationMethod | undefined;
    setSelectedAuthMethod: (method: AuthenticationMethod | undefined) => void;
    verificationContact: string;
    setVerificationContact: (contact: string) => void;
    getPlaceholderText: () => string;
    styles: Record<string, React.CSSProperties>;
    title?: string;
}

export interface AuthMethodRegistrationChallengeFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    challenge: string;
    setChallenge: (challenge: string) => void;
    styles: Record<string, React.CSSProperties>;
    title?: string;
}

export interface MfaChallengeFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    challenge: string;
    setChallenge: (challenge: string) => void;
    styles: Record<string, React.CSSProperties>;
    title?: string;
}

export interface MfaAuthMethodSelectionFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    authMethods: AuthenticationMethod[];
    selectedAuthMethod: AuthenticationMethod | undefined;
    setSelectedAuthMethod: (method: AuthenticationMethod | undefined) => void;
    styles: Record<string, React.CSSProperties>;
    title?: string;
}
