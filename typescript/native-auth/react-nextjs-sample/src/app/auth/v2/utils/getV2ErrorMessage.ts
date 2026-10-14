import { CustomAuthApiError } from "@azure/msal-browser/custom-auth";
import type { AuthFlowErrorV2 } from "@azure/msal-browser/custom-auth";

function getActionMessage(error: AuthFlowErrorV2): string | undefined {
    if (error.isInvalidInput()) {
        return "Check the supplied values and try again.";
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
        return "Complete all required account attributes.";
    }
    if (error.isBrowserRequired()) {
        return "Browser authentication is required to continue.";
    }
    return undefined;
}

export function getV2ErrorMessage(error: AuthFlowErrorV2 | null | undefined): string {
    if (!error) {
        return "No error details were returned.";
    }

    const actionMessage = getActionMessage(error);
    const serviceMessage =
        error.errorData.errorDescription ||
        error.errorData.message ||
        error.errorData.error ||
        error.errorDescription;
    const diagnosticMessages: string[] = [];

    if (error.errorData.subError) {
        diagnosticMessages.push(`Inner error code: ${error.errorData.subError}.`);
    }

    if (error.errorData instanceof CustomAuthApiError) {
        error.errorData.attributeValidationDetails?.forEach((detail) => {
            const attributes = Array.isArray(detail.attributeIds)
                ? detail.attributeIds.filter((attributeId) => typeof attributeId === "string").join(", ")
                : "";
            const code = detail.code ? `Code: ${detail.code}.` : "";
            const message = detail.message ? `Message: ${detail.message}` : "";
            const detailMessage = [attributes ? `Attributes: ${attributes}.` : "", code, message]
                .filter(Boolean)
                .join(" ");

            if (detailMessage) {
                diagnosticMessages.push(detailMessage);
            }
        });
    }

    return [
        serviceMessage || actionMessage || "The authentication request failed.",
        ...diagnosticMessages,
    ].join(" ");
}
