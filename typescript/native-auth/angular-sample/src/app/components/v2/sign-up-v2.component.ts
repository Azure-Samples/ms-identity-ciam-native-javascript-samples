import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
    AttributesRequiredStateV2,
    type AuthFlowErrorV2,
    AuthFlowStateBase,
    type AuthenticationMethodRegistrationV2,
    AuthMethodRegistrationRequiredStateV2,
    AuthMethodVerificationRequiredStateV2,
    CodeRequiredStateV2,
    CompletedStateV2,
    SignInContinuationStateV2,
    SignUpPasswordRequiredStateV2,
} from "@azure/msal-browser/custom-auth";
import type { CustomAuthAccountData, UserAccountAttributes } from "@azure/msal-browser/custom-auth";
import { AuthService } from "../../services/auth.service";
import { authorizationInputs } from "../../config/authorization-request-config";
import { AuthStartFormComponent } from "../shared/auth-start-form/auth-start-form.component";
import { AuthStepLayoutComponent } from "../shared/auth-step-layout/auth-step-layout.component";
import { CodeFormComponent } from "../shared/code-form/code-form.component";
import {
    AttributeField,
    AttributeValueChange,
    DynamicAttributesFormComponent,
} from "../shared/dynamic-attributes-form/dynamic-attributes-form.component";
import {
    MethodOption,
    MethodSelectionFormComponent,
} from "../shared/method-selection-form/method-selection-form.component";
import { PasswordFormComponent } from "../shared/password-form/password-form.component";
import {
    createV2ErrorPresentation,
    formatV2ErrorPresentation,
    getThrownErrorMessage,
    getV2ErrorPresentation,
    getV2FieldErrors,
    type V2ErrorPresentation,
    type V2FieldErrors,
} from "./v2-flow-utils";

type AttributeValues = Record<string, string>;

@Component({
    selector: "app-sign-up-v2",
    templateUrl: "./sign-up-v2.component.html",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        AuthStartFormComponent,
        AuthStepLayoutComponent,
        CodeFormComponent,
        DynamicAttributesFormComponent,
        MethodSelectionFormComponent,
        PasswordFormComponent,
    ],
})
export class SignUpV2Component implements OnInit {
    @Input() initialUsername = "";
    @Input() initialPassword = "";
    @Input() autoStart = false;
    @Input() embedded = false;

    @Output() cancel = new EventEmitter<void>();
    @Output() completed = new EventEmitter<CustomAuthAccountData | undefined>();
    @Output() ready = new EventEmitter<V2ErrorPresentation | undefined>();

    username = "";
    password = "";
    code = "";
    registrationContact = "";
    selectedRegistrationMethod: AuthenticationMethodRegistrationV2 | null = null;
    error = "";
    fieldErrors: V2FieldErrors = {};
    loading = false;
    resendLoading = false;
    resendCountdown = 0;
    attributeValues: AttributeValues = {};
    state: AuthFlowStateBase | null = null;
    userData: CustomAuthAccountData | undefined;
    private initialErrorPresentation: V2ErrorPresentation | undefined;

    constructor(private auth: AuthService) {}

    async ngOnInit(): Promise<void> {
        this.username = this.initialUsername;
        this.password = this.initialPassword;

        const client = await this.auth.getClient();
        const accountResult = client.getCurrentAccount();
        if (accountResult.isCompleted()) {
            this.userData = accountResult.data;
        } else if (this.autoStart) {
            await this.startSignUp();
        }
        this.ready.emit(
            this.initialErrorPresentation ??
                (this.error ? createV2ErrorPresentation(this.error) : undefined),
        );
    }

    get codeState(): CodeRequiredStateV2 | null {
        return this.state instanceof CodeRequiredStateV2 ? this.state : null;
    }

    get passwordState(): SignUpPasswordRequiredStateV2 | null {
        return this.state instanceof SignUpPasswordRequiredStateV2 ? this.state : null;
    }

    get attributesState(): AttributesRequiredStateV2 | null {
        return this.state instanceof AttributesRequiredStateV2 ? this.state : null;
    }

    get registrationState(): AuthMethodRegistrationRequiredStateV2 | null {
        return this.state instanceof AuthMethodRegistrationRequiredStateV2 ? this.state : null;
    }

    get activationState(): AuthMethodVerificationRequiredStateV2 | null {
        return this.state instanceof AuthMethodVerificationRequiredStateV2 ? this.state : null;
    }

    get continuationState(): SignInContinuationStateV2 | null {
        return this.state instanceof SignInContinuationStateV2 ? this.state : null;
    }

    get isCompleted(): boolean {
        return this.state instanceof CompletedStateV2;
    }

    get passwordAttributeFields(): readonly AttributeField[] {
        return this.toAttributeFields(this.passwordState?.attributes ?? []);
    }

    get attributeFields(): readonly AttributeField[] {
        return this.toAttributeFields(this.attributesState?.attributes ?? []);
    }

    get registrationMethodOptions(): readonly MethodOption[] {
        return (
            this.registrationState?.methods.map((method) => ({
                value: method.type,
                label: `${method.type}${method.channels?.length ? ` (${method.channels.join(", ")})` : ""}`,
            })) ?? []
        );
    }

    async startSignUp(): Promise<void> {
        this.resetFlow();
        this.loading = true;

        try {
            const client = await this.auth.getClient();
            const result = await client.signUpV2({
                username: this.username,
                ...(this.password ? { password: this.password } : {}),
                attributes: {},
                ...authorizationInputs,
            });

            if (result.isFailed()) {
                this.initialErrorPresentation = this.applyV2Error(result.error);
            } else if (
                result.isState("codeRequired") ||
                result.isState("passwordRequired") ||
                result.isState("attributesRequired")
            ) {
                this.state = result.state;
            } else {
                this.error = "Sign-up returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-up error occurred.");
        } finally {
            this.password = "";
            this.loading = false;
        }
    }

    async submitCode(): Promise<void> {
        const state = this.codeState;
        if (!state) {
            this.error = "Restart sign-up before submitting a verification code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitCode(this.code);
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("passwordRequired") || result.isState("attributesRequired")) {
                this.code = "";
                this.attributeValues = {};
                this.fieldErrors = {};
                this.state = result.state;
            } else if (result.isState("signInContinuation")) {
                this.code = "";
                await this.continueSignIn(result.state);
            } else if (result.isState("authMethodRegistrationRequired")) {
                this.code = "";
                this.state = result.state;
            } else if (result.isState("completed")) {
                this.complete(result.state, result.data);
            } else {
                this.error = "Code verification returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-up error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async resendCode(): Promise<void> {
        const state = this.codeState;
        if (!state) {
            this.error = "Restart sign-up before requesting another code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.resendLoading = true;
        try {
            const result = await state.resendCode();
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else {
                this.code = "";
                this.state = result.state;
                this.startResendCountdown();
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-up error occurred.");
        } finally {
            this.resendLoading = false;
        }
    }

    async submitPassword(): Promise<void> {
        const state = this.passwordState;
        if (!state) {
            this.error = "Restart sign-up before submitting a password.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitPassword(this.password, this.buildAttributes());
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("codeRequired")) {
                this.password = "";
                this.attributeValues = {};
                this.fieldErrors = {};
                this.state = result.state;
            } else if (result.isState("signInContinuation")) {
                this.password = "";
                this.attributeValues = {};
                this.fieldErrors = {};
                await this.continueSignIn(result.state);
            } else if (result.isState("authMethodRegistrationRequired")) {
                this.password = "";
                this.attributeValues = {};
                this.fieldErrors = {};
                this.state = result.state;
            } else {
                this.error = "Password submission returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-up error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async submitAttributes(): Promise<void> {
        const state = this.attributesState;
        if (!state) {
            this.error = "Restart sign-up before submitting attributes.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitAttributes(this.buildAttributes());
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("codeRequired")) {
                this.attributeValues = {};
                this.code = "";
                this.fieldErrors = {};
                this.state = result.state;
            } else if (result.isState("signInContinuation")) {
                this.attributeValues = {};
                this.fieldErrors = {};
                await this.continueSignIn(result.state);
            } else if (result.isState("authMethodRegistrationRequired")) {
                this.attributeValues = {};
                this.fieldErrors = {};
                this.state = result.state;
            } else {
                this.error = "Attribute submission returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-up error occurred.");
        } finally {
            this.loading = false;
        }
    }

    selectRegistrationMethod(methodType: string): void {
        const method = this.registrationState?.methods.find((item) => item.type === methodType);
        if (!method) {
            this.error = "The selected registration method is no longer available.";
            return;
        }

        this.selectedRegistrationMethod = method;
        this.registrationContact = "";
        this.error = "";
        this.fieldErrors = {};
    }

    async enrollAuthMethod(): Promise<void> {
        const state = this.registrationState;
        const method = this.selectedRegistrationMethod;
        if (!state || !method) {
            this.error = "Select an authentication method before registering.";
            return;
        }

        const contact = this.registrationContact.trim();
        if (!contact) {
            this.error = "Enter the email address or phone number to register.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.selectAuthMethod(method, contact);
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("authMethodVerificationRequired")) {
                this.code = "";
                this.resendCountdown = 0;
                this.state = result.state;
                this.selectedRegistrationMethod = null;
                this.registrationContact = "";
            } else {
                this.error = "Method registration returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected registration error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async submitActivationCode(): Promise<void> {
        const state = this.activationState;
        if (!state) {
            this.error = "Restart sign-up before submitting an activation code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitChallenge(this.code);
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("completed")) {
                this.complete(result.state, result.data);
            } else {
                this.error = "Method activation returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected activation error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async resendActivationCode(): Promise<void> {
        const state = this.activationState;
        if (!state) {
            this.error = "Restart sign-up before requesting another activation code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.resendLoading = true;
        try {
            const result = await state.resendChallenge();
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("authMethodVerificationRequired")) {
                this.code = "";
                this.state = result.state;
                this.startResendCountdown();
            } else {
                this.error = "Activation-code resend returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected activation-code resend error occurred.");
        } finally {
            this.resendLoading = false;
        }
    }

    async retryContinuation(): Promise<void> {
        const state = this.continuationState;
        if (state) {
            await this.continueSignIn(state);
        }
    }

    setAttributeValue(name: string, value: string): void {
        this.attributeValues = { ...this.attributeValues, [name]: value };
        this.clearFieldError(name);
    }

    onAttributeValueChange(change: AttributeValueChange): void {
        this.setAttributeValue(change.name, change.value);
    }

    restart(): void {
        if (this.embedded) {
            this.cancel.emit();
            return;
        }

        this.resetFlow();
    }

    onPasswordChange(password: string): void {
        this.password = password;
        this.clearFieldError("password");
    }

    clearFieldError(name: string): void {
        const normalizedName = name.toLowerCase();
        if (!this.fieldErrors[normalizedName]) {
            return;
        }

        const next = { ...this.fieldErrors };
        delete next[normalizedName];
        this.fieldErrors = next;
    }

    private async continueSignIn(state: SignInContinuationStateV2): Promise<void> {
        this.state = state;
        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.signIn();
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("completed")) {
                this.complete(result.state, result.data);
            } else {
                this.error = "Sign-in after sign-up returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-up error occurred.");
        } finally {
            this.loading = false;
        }
    }

    private buildAttributes(): UserAccountAttributes {
        const attributes: UserAccountAttributes = {};
        for (const [name, value] of Object.entries(this.attributeValues)) {
            if (value) {
                attributes[name] = value;
            }
        }
        return attributes;
    }

    private applyV2Error(error: AuthFlowErrorV2 | null | undefined): V2ErrorPresentation {
        const presentation = getV2ErrorPresentation(error);
        this.error = formatV2ErrorPresentation(presentation);
        this.fieldErrors = getV2FieldErrors(presentation);
        return presentation;
    }

    private toAttributeFields(
        attributes: readonly {
            attributeId: string;
            label?: string;
            required?: boolean;
            inputType?: string;
            regex?: string;
        }[],
    ): readonly AttributeField[] {
        return attributes.map((attribute) => ({
            name: attribute.attributeId,
            label: attribute.label || attribute.attributeId,
            required: attribute.required === true,
            inputType: attribute.inputType === "password" ? "password" : "text",
            pattern: attribute.regex,
        }));
    }

    private complete(state: CompletedStateV2, account?: CustomAuthAccountData): void {
        this.state = state;
        this.code = "";
        this.selectedRegistrationMethod = null;
        this.registrationContact = "";
        this.attributeValues = {};
        this.fieldErrors = {};
        this.userData = account;
        this.completed.emit(account);
    }

    private resetFlow(): void {
        this.state = null;
        this.userData = undefined;
        this.code = "";
        this.selectedRegistrationMethod = null;
        this.registrationContact = "";
        this.error = "";
        this.attributeValues = {};
        this.fieldErrors = {};
        this.resendCountdown = 0;
        this.initialErrorPresentation = undefined;
    }

    private startResendCountdown(): void {
        this.resendCountdown = 30;
        const timer = window.setInterval(() => {
            this.resendCountdown = Math.max(0, this.resendCountdown - 1);
            if (this.resendCountdown === 0) {
                window.clearInterval(timer);
            }
        }, 1000);
    }
}
