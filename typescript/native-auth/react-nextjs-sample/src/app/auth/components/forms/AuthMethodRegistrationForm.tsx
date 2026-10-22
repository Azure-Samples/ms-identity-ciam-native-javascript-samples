import { useId } from "react";
import type { FormEvent } from "react";
import type { MethodOption } from "./MethodSelectionForm";

interface AuthMethodRegistrationFormProps {
    loading: boolean;
    canSubmit: boolean;
    onSubmit: (event: FormEvent) => Promise<void>;
    verificationContact: string;
    onContactChange: (contact: string) => void;
    contactType: "email" | "tel" | "text";
    contactLabel?: string;
    contactPlaceholder?: string;
    contactAutoComplete?: string;
    title?: string;
    methodSelection?: {
        options: readonly MethodOption[];
        value: string;
        onChange: (value: string) => void;
    };
    submitText?: string;
    submittingText?: string;
    onChooseAnotherMethod?: () => void;
}

export function AuthMethodRegistrationForm({
    loading,
    canSubmit,
    onSubmit,
    verificationContact,
    onContactChange,
    contactType,
    contactLabel,
    contactPlaceholder,
    contactAutoComplete,
    title,
    methodSelection,
    submitText = "Register method",
    submittingText = "Registering...",
    onChooseAnotherMethod,
}: AuthMethodRegistrationFormProps) {
    const contactId = useId();
    const disabled = loading || !canSubmit;

    return (
        <div>
            {title && (
                <h3
                    style={{
                        marginBottom: "1rem",
                        color: "#374151",
                        fontSize: "1rem",
                        fontWeight: 500,
                        textAlign: "center",
                    }}
                >
                    {title}
                </h3>
            )}
            <form onSubmit={onSubmit} className="auth-form">
                {methodSelection && (
                    <select
                        value={methodSelection.value}
                        onChange={(event) => methodSelection.onChange(event.target.value)}
                        className="auth-input auth-capitalize"
                        required
                        disabled={loading}
                    >
                        {methodSelection.options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                )}
                {contactLabel && <label htmlFor={contactId}>{contactLabel}</label>}
                <input
                    id={contactId}
                    name="registrationContact"
                    type={contactType}
                    autoComplete={contactAutoComplete}
                    value={verificationContact}
                    onChange={(event) => onContactChange(event.target.value)}
                    placeholder={contactPlaceholder}
                    className="auth-input"
                    disabled={loading}
                    required
                />
                <button
                    type="submit"
                    disabled={disabled}
                    className={disabled ? "auth-button-disabled" : "auth-button"}
                >
                    {loading ? submittingText : submitText}
                </button>
                {onChooseAnotherMethod && (
                    <button
                        type="button"
                        className="auth-secondary-button"
                        disabled={loading}
                        onClick={onChooseAnotherMethod}
                    >
                        Choose another method
                    </button>
                )}
            </form>
        </div>
    );
}
