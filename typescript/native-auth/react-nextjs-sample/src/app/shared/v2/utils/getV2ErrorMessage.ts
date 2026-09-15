interface V2ErrorDetails {
    errorDescription?: string;
    message?: string;
    errorData?: {
        error?: string;
        errorDescription?: string;
        subError?: string;
        attributeValidationDetails?: Array<{
            attributeIds?: string[];
            code?: string;
            message?: string;
        }>;
    };
}

export function getV2ErrorMessage(error: V2ErrorDetails | null | undefined): string {
    const outerMessage =
        error?.errorDescription ||
        error?.errorData?.errorDescription ||
        error?.message ||
        error?.errorData?.error ||
        "No error details were returned.";
    const innerMessages: string[] = [];

    if (error?.errorData?.subError) {
        innerMessages.push(`Inner error code: ${error.errorData.subError}.`);
    }

    error?.errorData?.attributeValidationDetails?.forEach((detail) => {
        const attributes = detail.attributeIds?.join(", ");
        const code = detail.code ? `Code: ${detail.code}.` : "";
        const message = detail.message ? `Message: ${detail.message}` : "";
        const detailMessage = [attributes ? `Attributes: ${attributes}.` : "", code, message]
            .filter(Boolean)
            .join(" ");

        if (detailMessage) {
            innerMessages.push(detailMessage);
        }
    });

    return [outerMessage, ...innerMessages].join(" ");
}
