import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
    AttributesRequiredStateV2,
    AuthFlowStateBase,
    type AuthenticationMethodRegistrationV2,
    AuthMethodRegistrationRequiredStateV2,
    AuthMethodSelectionRequiredStateV2,
    AuthMethodVerificationRequiredStateV2,
    CodeRequiredStateV2,
    CompletedStateV2,
    ExistingAccountCodeRequiredStateV2,
    ExistingAccountPasswordRequiredStateV2,
    MFAVerificationRequiredStateV2,
    SignInContinuationStateV2,
    PasswordRequiredStateV2,
} from "@azure/msal-browser/custom-auth";
import type { CustomAuthAccountData, UserAccountAttributes } from "@azure/msal-browser/custom-auth";
import { AuthService } from "../../services/auth.service";
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
    getThrownErrorMessage,
    type V2ErrorPresentation,
    type V2FieldErrors,
} from "./v2-flow-utils";
import { handleV2Result, type V2ResultContext } from "./v2-result-handler";

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
export class SignUpV2Component implements OnInit, OnDestroy {
    @Input() initialUsername = "";
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
    private resendTimer: number | undefined;
    private destroyed = false;
    private readonly resultContext: V2ResultContext = {
        flow: "signUp",
        view: this,
        rememberError: (presentation) => {
            this.initialErrorPresentation = presentation;
        },
        complete: (state, account) => this.complete(state, account),
        continueSignIn: (state) => this.continueSignIn(state),
        startResendCountdown: () => this.startResendCountdown(),
        stopResendCountdown: () => this.stopResendCountdown(),
    };

    constructor(private auth: AuthService) {}

    async ngOnInit(): Promise<void> {
        this.username = this.initialUsername;

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

    ngOnDestroy(): void {
        this.destroyed = true;
        this.stopResendCountdown();
    }

    get codeState(): CodeRequiredStateV2 | ExistingAccountCodeRequiredStateV2 | null {
        return this.state instanceof CodeRequiredStateV2 || this.state instanceof ExistingAccountCodeRequiredStateV2
            ? this.state
            : null;
    }

    get existingAccountCodeState(): ExistingAccountCodeRequiredStateV2 | null {
        return this.state instanceof ExistingAccountCodeRequiredStateV2 ? this.state : null;
    }

    get passwordState(): PasswordRequiredStateV2 | null {
        return this.state instanceof PasswordRequiredStateV2 ? this.state : null;
    }

    get existingAccountPasswordState(): ExistingAccountPasswordRequiredStateV2 | null {
        return this.state instanceof ExistingAccountPasswordRequiredStateV2 ? this.state : null;
    }

    get attributesState(): AttributesRequiredStateV2 | null {
        return this.state instanceof AttributesRequiredStateV2 ? this.state : null;
    }

    get methodSelectionState(): AuthMethodSelectionRequiredStateV2 | null {
        return this.state instanceof AuthMethodSelectionRequiredStateV2 ? this.state : null;
    }

    get mfaVerificationState(): MFAVerificationRequiredStateV2 | null {
        return this.state instanceof MFAVerificationRequiredStateV2 ? this.state : null;
    }

    get registrationState(): AuthMethodRegistrationRequiredStateV2 | null {
        return this.state instanceof AuthMethodRegistrationRequiredStateV2 ? this.state : null;
    }

    get activationState(): AuthMethodVerificationRequiredStateV2 | null {
        return this.state instanceof AuthMethodVerificationRequiredStateV2 ? this.state : null;
    }

    get verificationState(): AuthMethodVerificationRequiredStateV2 | MFAVerificationRequiredStateV2 | null {
        return this.activationState ?? this.mfaVerificationState;
    }

    get continuationState(): SignInContinuationStateV2 | null {
        return this.state instanceof SignInContinuationStateV2 ? this.state : null;
    }

    get isCompleted(): boolean {
        return this.state instanceof CompletedStateV2;
    }

    get attributeFields(): readonly AttributeField[] {
        return this.toAttributeFields(this.attributesState?.attributes ?? []);
    }

    get methodOptions(): readonly MethodOption[] {
        return (
            this.methodSelectionState?.methods.map((method) => ({
                value: method.id,
                label: `${method.type}${method.hint ? ` (${method.hint})` : ""}`,
            })) ?? []
        );
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
            });

            await handleV2Result(result, this.resultContext);
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
            await handleV2Result(result, this.resultContext, { type: "submitCode", state });
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
            await handleV2Result(result, this.resultContext, { type: "resend" });
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-up error occurred.");
        } finally {
            this.resendLoading = false;
        }
    }

    async submitPassword(): Promise<void> {
        const state = this.passwordState ?? this.existingAccountPasswordState;
        if (!state) {
            this.error = "Restart sign-up before submitting a password.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitPassword(this.password);
            await handleV2Result(result, this.resultContext);
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
            await handleV2Result(result, this.resultContext, { type: "submitAttributes" });
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-up error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async selectAuthMethod(methodId: string): Promise<void> {
        const state = this.methodSelectionState;
        if (!state) {
            this.error = "Restart sign-up before selecting an authentication method.";
            return;
        }

        const method = state.methods.find((item) => item.id === methodId);
        if (!method) {
            this.error = "The selected authentication method is no longer available.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.selectAuthMethod(method);
            await handleV2Result(result, this.resultContext);
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

    chooseAnotherRegistrationMethod(): void {
        this.selectedRegistrationMethod = null;
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
            await handleV2Result(result, this.resultContext);
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected registration error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async submitVerificationCode(): Promise<void> {
        const state = this.verificationState;
        if (!state) {
            this.error = "Restart sign-up before submitting a verification code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitChallenge(this.code);
            await handleV2Result(result, this.resultContext);
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected verification error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async resendVerificationCode(): Promise<void> {
        const state = this.verificationState;
        if (!state) {
            this.error = "Restart sign-up before requesting another verification code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.resendLoading = true;
        try {
            const result = await state.resendChallenge();
            await handleV2Result(result, this.resultContext, { type: "resend" });
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected verification-code resend error occurred.");
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
            await handleV2Result(result, this.resultContext);
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
        this.stopResendCountdown();
        this.state = state;
        this.password = "";
        this.code = "";
        this.selectedRegistrationMethod = null;
        this.registrationContact = "";
        this.attributeValues = {};
        this.fieldErrors = {};
        this.userData = account;
        this.completed.emit(account);
    }

    private resetFlow(): void {
        this.stopResendCountdown();
        this.state = null;
        this.userData = undefined;
        this.password = "";
        this.code = "";
        this.selectedRegistrationMethod = null;
        this.registrationContact = "";
        this.error = "";
        this.attributeValues = {};
        this.fieldErrors = {};
        this.initialErrorPresentation = undefined;
    }

    private startResendCountdown(): void {
        this.stopResendCountdown();
        if (this.destroyed) {
            return;
        }
        this.resendCountdown = 30;
        this.resendTimer = window.setInterval(() => {
            this.resendCountdown = Math.max(0, this.resendCountdown - 1);
            if (this.resendCountdown === 0) {
                this.stopResendCountdown();
            }
        }, 1000);
    }

    private stopResendCountdown(): void {
        if (this.resendTimer !== undefined) {
            window.clearInterval(this.resendTimer);
            this.resendTimer = undefined;
        }
        this.resendCountdown = 0;
    }
}
