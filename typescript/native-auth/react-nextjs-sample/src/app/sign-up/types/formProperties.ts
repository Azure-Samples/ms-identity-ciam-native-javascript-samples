import { FormProps } from "@/app/shared/types/formProperties";

export interface SignUpInitialFormProps extends FormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    firstName: string;
    setFirstName: (value: string) => void;
    lastName: string;
    setLastName: (value: string) => void;
    jobTitle: string;
    setJobTitle: (value: string) => void;
    city: string;
    setCity: (value: string) => void;
    country: string;
    setCountry: (value: string) => void;
    email: string;
    setEmail: (value: string) => void;
    flatUsername: string;
    setFlatUsername: (value: string) => void;
    onSignUpWithSocial: (domainHint: string) => Promise<void>;
}
