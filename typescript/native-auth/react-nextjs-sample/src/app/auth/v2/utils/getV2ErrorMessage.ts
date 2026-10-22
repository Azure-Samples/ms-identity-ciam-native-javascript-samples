import type { AuthFlowErrorV2 } from "@azure/msal-browser/custom-auth";

export interface V2ErrorPresentation {
    message: string;
    requiredAttributes: readonly string[];
    invalidAttributes: readonly string[];
    errorCode?: string;
    innerErrorCode?: string;
    subError?: string;
    correlationId?: string;
}

export type V2FieldErrors = Readonly<Record<string, string>>;

function normalizeAttributeIds(attributeIds: readonly string[] | undefined): readonly string[] {
    return Array.isArray(attributeIds) ? attributeIds : [];
}

function getActionMessage(error: AuthFlowErrorV2, invalidAttributes: readonly string[]): string | undefined {
    if (error.isBrowserRequired()) {
        return "Browser authentication is required to continue.";
    }
    if (error.isInvalidCredentials()) {
        return "The username or password is incorrect.";
    }
    if (error.isInvalidCode()) {
        return "The verification code is invalid. Try again or request a new code.";
    }
    if (error.isInvalidPassword()) {
        return "The password does not meet the required policy.";
    }
    if (error.isInvalidUsername()) {
        return "Enter a valid username.";
    }
    if (error.isUserNotFound()) {
        return "No account was found for this username.";
    }
    if (error.isUserAlreadyExists()) {
        return "An account already exists for this username.";
    }
    if (error.isMissingRequiredAttributes()) {
        return invalidAttributes.length > 0
            ? "Complete all required account attributes and correct the invalid values."
            : "Complete all required account attributes.";
    }
    if (invalidAttributes.length > 0) {
        return "Correct the invalid account attributes.";
    }
    if (error.isInvalidInput()) {
        return "Check the supplied values and try again.";
    }
    return undefined;
}

export function getV2ErrorPresentation(error: AuthFlowErrorV2 | null | undefined): V2ErrorPresentation {
    if (!error) {
        return {
            message: "No error details were returned.",
            requiredAttributes: [],
            invalidAttributes: [],
        };
    }

    const requiredAttributes = normalizeAttributeIds(error.requiredAttributes);
    const invalidAttributes = normalizeAttributeIds(error.invalidAttributes);
    const actionMessage = getActionMessage(error, invalidAttributes);

    return {
        message: actionMessage || error.errorDescription || error.errorData.message || "The authentication request failed.",
        requiredAttributes,
        invalidAttributes,
        errorCode: actionMessage ? undefined : error.errorData.error,
        innerErrorCode: error.innerErrorCode,
        subError: error.errorData.subError,
        correlationId: error.correlationId,
    };
}

export function formatV2ErrorPresentation(presentation: V2ErrorPresentation): string {
    const diagnosticMessages = [
        presentation.requiredAttributes.length > 0
            ? `Required attributes: ${presentation.requiredAttributes.join(", ")}.`
            : "",
        presentation.invalidAttributes.length > 0
            ? `Invalid attributes: ${presentation.invalidAttributes.join(", ")}.`
            : "",
        presentation.errorCode ? `Error code: ${presentation.errorCode}.` : "",
        presentation.innerErrorCode ? `Inner error code: ${presentation.innerErrorCode}.` : "",
        presentation.subError ? `OAuth suberror: ${presentation.subError}.` : "",
        presentation.correlationId ? `Correlation ID: ${presentation.correlationId}.` : "",
    ].filter(Boolean);

    return [presentation.message, ...diagnosticMessages].join(" ");
}

function normalizeAttributeId(attributeId: string): string | undefined {
    const normalizedAttributeId = attributeId.toLowerCase();
    return normalizedAttributeId === "__proto__" ||
        normalizedAttributeId === "prototype" ||
        normalizedAttributeId === "constructor"
        ? undefined
        : normalizedAttributeId;
}

export function getV2FieldErrors(presentation: V2ErrorPresentation): V2FieldErrors {
    const fieldErrors: Record<string, string> = Object.create(null) as Record<string, string>;

    for (const attributeId of presentation.invalidAttributes) {
        const normalizedAttributeId = normalizeAttributeId(attributeId);
        if (normalizedAttributeId) {
            fieldErrors[normalizedAttributeId] = "The value is invalid. Check the field requirements.";
        }
    }

    for (const attributeId of presentation.requiredAttributes) {
        const normalizedAttributeId = normalizeAttributeId(attributeId);
        if (normalizedAttributeId) {
            fieldErrors[normalizedAttributeId] = "This field is required.";
        }
    }

    return fieldErrors;
}

export function getV2ErrorMessage(error: AuthFlowErrorV2 | null | undefined): string {
    return formatV2ErrorPresentation(getV2ErrorPresentation(error));
}
