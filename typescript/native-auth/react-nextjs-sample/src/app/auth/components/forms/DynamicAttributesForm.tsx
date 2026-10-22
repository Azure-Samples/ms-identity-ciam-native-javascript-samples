
export interface AttributeField {
    name: string;
    label: string;
    required: boolean;
    inputType: "text" | "password";
    pattern?: string;
}

interface DynamicAttributesFormProps {
    fields: readonly AttributeField[];
    values: Readonly<Record<string, string>>;
    fieldErrors?: Readonly<Record<string, string>>;
    onChange: (name: string, value: string) => void;
    onSubmit: (event: React.FormEvent) => Promise<void>;
    loading: boolean;
    error?: string;
    noValidate?: boolean;
}

interface DynamicAttributeFieldsProps {
    fields: readonly AttributeField[];
    values: Readonly<Record<string, string>>;
    fieldErrors?: Readonly<Record<string, string>>;
    onChange: (name: string, value: string) => void;
}

export function DynamicAttributeFields({ fields, values, fieldErrors, onChange }: DynamicAttributeFieldsProps) {
    return (
        <>
            <p className="auth-helper-text">
                Complete the attributes configured for this tenant. Fields marked optional may be left empty.
            </p>
            {fields.map((field, index) => {
                const fieldError = fieldErrors?.[field.name.toLowerCase()];
                const fieldId = `auth-attribute-${index}`;
                const errorId = `${fieldId}-error`;

                return (
                    <label key={field.name} htmlFor={fieldId}>
                        {field.label}
                        {field.required ? " *" : " (optional)"}
                        <input
                            id={fieldId}
                            name={field.name}
                            type={field.inputType}
                            required={field.required}
                            pattern={field.pattern}
                            value={values[field.name] ?? ""}
                            onChange={(event) => onChange(field.name, event.target.value)}
                            className="auth-input"
                            aria-invalid={fieldError ? true : undefined}
                            aria-describedby={fieldError ? errorId : undefined}
                        />
                        {fieldError && (
                            <span id={errorId} className="auth-field-error" role="alert">
                                {fieldError}
                            </span>
                        )}
                    </label>
                );
            })}
        </>
    );
}

export function DynamicAttributesForm({
    fields,
    values,
    fieldErrors,
    onChange,
    onSubmit,
    loading,
    error,
    noValidate = false,
}: DynamicAttributesFormProps) {
    return (
        <form onSubmit={onSubmit} className="auth-form" noValidate={noValidate}>
            <DynamicAttributeFields
                fields={fields}
                values={values}
                fieldErrors={fieldErrors}
                onChange={onChange}
            />
            {error && <div className="auth-error">{error}</div>}
            <button
                type="submit"
                className={loading ? "auth-button-disabled" : "auth-button"}
                disabled={loading}
            >
                {loading ? "Submitting..." : "Continue"}
            </button>
        </form>
    );
}
