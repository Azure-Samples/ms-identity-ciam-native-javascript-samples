"use client";

import { useEffect, useState } from "react";
import type { AuthenticationMethodV2 } from "@azure/msal-browser/custom-auth";
import { styles } from "@/app/reset-password/styles/styles";

interface MethodSelectionFormPropsV2 {
    methods: readonly AuthenticationMethodV2[];
    onSubmit: (method: AuthenticationMethodV2) => Promise<void>;
    loading: boolean;
}

export function MethodSelectionFormV2({ methods, onSubmit, loading }: MethodSelectionFormPropsV2) {
    const [selectedId, setSelectedId] = useState(methods[0]?.id ?? "");

    useEffect(() => {
        if (!methods.some((method) => method.id === selectedId)) {
            setSelectedId(methods[0]?.id ?? "");
        }
    }, [methods, selectedId]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const selectedMethod = methods.find((method) => method.id === selectedId);
        if (selectedMethod) {
            await onSubmit(selectedMethod);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={styles.form}>
            <div>Choose how to receive your verification code:</div>
            {methods.map((method) => (
                <label key={method.id} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                        type="radio"
                        name="method"
                        value={method.id}
                        checked={selectedId === method.id}
                        onChange={() => setSelectedId(method.id)}
                    />
                    <span>
                        {method.type}
                        {method.hint ? ` (${method.hint})` : ""}
                    </span>
                </label>
            ))}
            <button type="submit" style={styles.button} disabled={loading || !selectedId}>
                {loading ? "Sending..." : "Send code"}
            </button>
        </form>
    );
}
