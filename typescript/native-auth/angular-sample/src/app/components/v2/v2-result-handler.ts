import type {
    AttributesRequiredStateV2,
    AuthFlowStateBase,
    AuthenticationMethodRegistrationV2,
    AuthMethodRegistrationRequiredStateV2,
    AuthMethodSelectionRequiredStateV2,
    AuthMethodVerificationRequiredStateV2,
    CodeRequiredStateV2,
    CompletedStateV2,
    CustomAuthAccountData,
    CustomAuthResultV2,
    ExistingAccountCodeRequiredStateV2,
    ExistingAccountPasswordRequiredStateV2,
    FailedStateV2,
    MFAVerificationRequiredStateV2,
    NewPasswordRequiredStateV2,
    PasswordRequiredStateV2,
    SignInContinuationStateV2,
} from "@azure/msal-browser/custom-auth";
import {
    formatV2ErrorPresentation,
    getV2ErrorPresentation,
    getV2FieldErrors,
    type V2ErrorPresentation,
    type V2FieldErrors,
} from "./v2-flow-utils";

export type V2InteractiveState =
    | PasswordRequiredStateV2
    | ExistingAccountPasswordRequiredStateV2
    | CodeRequiredStateV2
    | ExistingAccountCodeRequiredStateV2
    | AttributesRequiredStateV2
    | NewPasswordRequiredStateV2
    | AuthMethodSelectionRequiredStateV2
    | AuthMethodRegistrationRequiredStateV2
    | AuthMethodVerificationRequiredStateV2
    | MFAVerificationRequiredStateV2;

export type V2FlowState = V2InteractiveState | SignInContinuationStateV2 | CompletedStateV2 | FailedStateV2;

export type V2FlowResult = CustomAuthResultV2<V2FlowState, CustomAuthAccountData | void>;

export type V2ResultOperation =
    | { type: "submitCode"; state: CodeRequiredStateV2 | ExistingAccountCodeRequiredStateV2 }
    | { type: "submitAttributes" | "resend" };

export interface V2ResultContext {
    readonly flow: "signIn" | "signUp" | "resetPassword";
    readonly view: {
        state: AuthFlowStateBase | null;
        password: string;
        code: string;
        error: string;
        fieldErrors: V2FieldErrors;
        selectedRegistrationMethod: AuthenticationMethodRegistrationV2 | null;
        registrationContact: string;
        attributeValues?: Record<string, string>;
    };
    rememberError(presentation: V2ErrorPresentation): void;
    complete(state: CompletedStateV2, account: CustomAuthAccountData | undefined): void;
    continueSignIn?(state: SignInContinuationStateV2): Promise<void>;
    startResendCountdown(): void;
    stopResendCountdown(): void;
}

const FORM_STATES_BY_FLOW: Readonly<Record<V2ResultContext["flow"], readonly V2InteractiveState["stateType"][]>> = {
    signIn: [
        "passwordRequired",
        "codeRequired",
        "authMethodSelectionRequired",
        "authMethodRegistrationRequired",
        "authMethodVerificationRequired",
        "mfaVerificationRequired",
    ],
    signUp: [
        "passwordRequired",
        "existingAccountPasswordRequired",
        "codeRequired",
        "existingAccountCodeRequired",
        "attributesRequired",
        "authMethodSelectionRequired",
        "authMethodRegistrationRequired",
        "authMethodVerificationRequired",
        "mfaVerificationRequired",
    ],
    resetPassword: [
        "codeRequired",
        "newPasswordRequired",
        "authMethodSelectionRequired",
        "authMethodRegistrationRequired",
        "authMethodVerificationRequired",
        "mfaVerificationRequired",
    ],
};

const FLOW_LABELS: Readonly<Record<V2ResultContext["flow"], string>> = {
    signIn: "Sign-in",
    signUp: "Sign-up",
    resetPassword: "Password reset",
};

export async function handleV2Result(
    result: V2FlowResult,
    context: V2ResultContext,
    operation?: V2ResultOperation
): Promise<void> {
    const state = result.state;
    const view = context.view;
    const unsupportedMessage = `${FLOW_LABELS[context.flow]} returned an unsupported state.`;
    const wasSelectingMethod = view.state?.stateType === "authMethodSelectionRequired";
    let shouldStopResendCountdown = wasSelectingMethod && context.flow !== "signIn";
    let shouldClearRegistration = wasSelectingMethod && context.flow === "resetPassword";
    let isCodeVerificationStep = false;

    switch (state.stateType) {
        case "failed": {
            const presentation = getV2ErrorPresentation(result.error);
            view.error = formatV2ErrorPresentation(presentation);
            view.fieldErrors = getV2FieldErrors(presentation);
            context.rememberError(presentation);

            const isAttributeSubmission = operation?.type === "submitAttributes";
            const isNewAccountCodeSubmission =
                operation?.type === "submitCode" && operation.state.stateType === "codeRequired";
            const hasAttributeError =
                presentation.invalidAttributes.length > 0 ||
                presentation.requiredAttributes.length > 0 ||
                presentation.innerErrorCode === "attributeValidationError";

            if (
                context.flow === "signUp" &&
                (isAttributeSubmission || isNewAccountCodeSubmission) &&
                hasAttributeError
            ) {
                view.state = state;
                view.code = "";
                context.stopResendCountdown();
                view.error += " Restart sign-up to correct the profile attributes.";
            }
            return;
        }
        case "completed":
            if (context.flow === "resetPassword") {
                view.code = "";
                view.registrationContact = "";
            }
            context.complete(state, result.data || undefined);
            return;
        case "signInContinuation":
            if (!context.continueSignIn) {
                view.error = unsupportedMessage;
                return;
            }
            view.code = "";
            if (context.flow === "signUp") {
                view.password = "";
                view.attributeValues = {};
            } else if (context.flow === "resetPassword") {
                view.registrationContact = "";
            }
            context.stopResendCountdown();
            await context.continueSignIn(state);
            return;
        case "passwordRequired":
        case "existingAccountPasswordRequired":
        case "attributesRequired":
        case "newPasswordRequired":
            break;
        case "codeRequired":
        case "existingAccountCodeRequired":
        case "mfaVerificationRequired":
            isCodeVerificationStep = true;
            break;
        case "authMethodSelectionRequired":
        case "authMethodRegistrationRequired":
            shouldStopResendCountdown = context.flow !== "signIn";
            shouldClearRegistration = context.flow === "resetPassword";
            break;
        case "authMethodVerificationRequired":
            shouldStopResendCountdown = true;
            shouldClearRegistration = true;
            isCodeVerificationStep = true;
            break;
        default:
            view.error = unsupportedMessage;
            return;
    }

    const hasFormForReturnedState = FORM_STATES_BY_FLOW[context.flow].includes(state.stateType);
    if (!hasFormForReturnedState) {
        view.error = unsupportedMessage;
        return;
    }

    view.code = "";
    if (context.flow === "signUp") {
        view.password = "";
        view.attributeValues = {};
    }
    view.state = state;

    if (shouldStopResendCountdown) {
        context.stopResendCountdown();
    }
    if (shouldClearRegistration) {
        view.selectedRegistrationMethod = null;
        view.registrationContact = "";
    }
    if (operation?.type === "resend" && isCodeVerificationStep) {
        context.startResendCountdown();
    }
}
