import { useEffect, useState } from "react";

export interface MethodOption {
    value: string;
    label: string;
}

interface MethodSelectionFormProps {
    options: readonly MethodOption[];
    onSubmit: (value: string) => Promise<void>;
    onSelectionChange?: (value: string) => void;
    loading: boolean;
    title?: string;
    description?: string;
    submitText?: string;
    submittingText?: string;
}

export function MethodSelectionForm({
    options,
    onSubmit,
    onSelectionChange,
    loading,
    title,
    description,
    submitText = "Choose",
    submittingText = "Loading...",
}: MethodSelectionFormProps) {
    const [selectedValue, setSelectedValue] = useState(options[0]?.value ?? "");

    useEffect(() => {
        if (!options.some((option) => option.value === selectedValue)) {
            setSelectedValue(options[0]?.value ?? "");
        }
    }, [options, selectedValue]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (loading || !options.some((option) => option.value === selectedValue)) {
            return;
        }

        await onSubmit(selectedValue);
    };

    const selectionUnavailable = !options.some((option) => option.value === selectedValue);

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
            <form onSubmit={handleSubmit} className="auth-form">
                {description && <div>{description}</div>}
                <select
                    value={selectedValue}
                    onChange={(event) => {
                        setSelectedValue(event.target.value);
                        onSelectionChange?.(event.target.value);
                    }}
                    className="auth-input auth-capitalize"
                    required
                    disabled={loading || options.length === 0}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    disabled={loading || selectionUnavailable}
                    className={loading || selectionUnavailable ? "auth-button-disabled" : "auth-button"}
                >
                    {loading ? submittingText : submitText}
                </button>
            </form>
        </div>
    );
}
