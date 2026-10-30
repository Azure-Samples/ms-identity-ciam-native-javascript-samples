import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
    type AuthFlowErrorV2,
    AuthFlowStateBase,
    AuthMethodRegistrationRequiredStateV2,
    AuthMethodSelectionRequiredStateV2,
    AuthMethodVerificationRequiredStateV2,
    CodeRequiredStateV2,
    CompletedStateV2,
    NewPasswordRequiredStateV2,
    SignInContinuationStateV2,
} from "@azure/msal-browser/custom-auth";
import type { AuthenticationMethodRegistrationV2, CustomAuthAccountData } from "@azure/msal-browser/custom-auth";
import { authorizationInputs } from "../../config/authorization-request-config";
import { AuthService } from "../../services/auth.service";
import { AuthStartFormComponent } from "../shared/auth-start-form/auth-start-form.component";
import { AuthStepLayoutComponent } from "../shared/auth-step-layout/auth-step-layout.component";
import { CodeFormComponent } from "../shared/code-form/code-form.component";
import {
    MethodOption,
    MethodSelectionFormComponent,
} from "../shared/method-selection-form/method-selection-form.component";
import { NewPasswordFormComponent } from "../shared/new-password-form/new-password-form.component";
import {
    createV2ErrorPresentation,
    formatV2ErrorPresentation,
    getThrownErrorMessage,
    getV2ErrorPresentation,
    getV2FieldErrors,
    type V2ErrorPresentation,
    type V2FieldErrors,
} from "./v2-flow-utils";

@Component({
    selector: "app-reset-password-v2",
    templateUrl: "./reset-password-v2.component.html",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        AuthStartFormComponent,
        AuthStepLayoutComponent,
        CodeFormComponent,
        MethodSelectionFormComponent,
        NewPasswordFormComponent,
    ],
})
export class ResetPasswordV2Component implements OnInit, OnDestroy {
    @Input() initialUsername = "";
    @Input() autoStart = false;
    @Input() embedded = false;

    @Output() cancel = new EventEmitter<void>();
    @Output() completed = new EventEmitter<CustomAuthAccountData | undefined>();
    @Output() ready = new EventEmitter<V2ErrorPresentation | undefined>();

    username = "";
    code = "";
    selectedRegistrationMethod: AuthenticationMethodRegistrationV2 | null = null;
    registrationContact = "";
    error = "";
    fieldErrors: V2FieldErrors = {};
    loading = false;
    resendLoading = false;
    resendCountdown = 0;
    state: AuthFlowStateBase | null = null;
    userData: CustomAuthAccountData | undefined;
    private initialErrorPresentation: V2ErrorPresentation | undefined;
    private resendTimer: number | undefined;

    constructor(private auth: AuthService) {}

    async ngOnInit(): Promise<void> {
        this.username = this.initialUsername;
        if (this.autoStart) {
            await this.startResetPassword();
        }
        this.ready.emit(
            this.initialErrorPresentation ??
                (this.error ? createV2ErrorPresentation(this.error) : undefined),
        );
    }

    ngOnDestroy(): void {
        this.stopResendCountdown();
    }

    get methodSelectionState(): AuthMethodSelectionRequiredStateV2 | null {
        return this.state instanceof AuthMethodSelectionRequiredStateV2 ? this.state : null;
    }

    get codeState(): CodeRequiredStateV2 | null {
        return this.state instanceof CodeRequiredStateV2 ? this.state : null;
    }

    get newPasswordState(): NewPasswordRequiredStateV2 | null {
        return this.state instanceof NewPasswordRequiredStateV2 ? this.state : null;
    }

    get continuationState(): SignInContinuationStateV2 | null {
        return this.state instanceof SignInContinuationStateV2 ? this.state : null;
    }

    get registrationState(): AuthMethodRegistrationRequiredStateV2 | null {
        return this.state instanceof AuthMethodRegistrationRequiredStateV2 ? this.state : null;
    }

    get registrationVerificationState(): AuthMethodVerificationRequiredStateV2 | null {
        return this.state instanceof AuthMethodVerificationRequiredStateV2 ? this.state : null;
    }

    get isCompleted(): boolean {
        return this.state instanceof CompletedStateV2;
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

    async startResetPassword(): Promise<void> {
        this.resetFlow();
        this.loading = true;

        try {
            const client = await this.auth.getClient();
            const result = await client.resetPasswordV2({
                username: this.username,
                ...authorizationInputs,
            });
            if (result.isFailed()) {
                this.initialErrorPresentation = this.applyV2Error(result.error);
            } else if (result.isState("authMethodSelectionRequired") || result.isState("codeRequired")) {
                this.state = result.state;
            } else {
                this.error = "Password reset returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected password reset error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async selectAuthMethod(methodId: string): Promise<void> {
        const state = this.methodSelectionState;
        if (!state) {
            this.error = "Restart password reset before selecting an authentication method.";
            return;
        }

        const method = state.methods.find((item) => item.id === methodId);
        if (!method) {
            this.error = "The selected verification method is no longer available.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.selectAuthMethod(method);
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("codeRequired")) {
                this.code = "";
                this.state = result.state;
            } else {
                this.error = "Authentication method selection returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected password reset error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async submitCode(): Promise<void> {
        const state = this.codeState;
        if (!state) {
            this.error = "Restart password reset before submitting a verification code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitCode(this.code);
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("newPasswordRequired")) {
                this.code = "";
                this.state = result.state;
            } else {
                this.error = "Code verification returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected password reset error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async resendCode(): Promise<void> {
        const state = this.codeState;
        if (!state) {
            this.error = "Restart password reset before requesting another code.";
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
            this.error = getThrownErrorMessage(error, "An unexpected password reset error occurred.");
        } finally {
            this.resendLoading = false;
        }
    }

    async submitNewPassword(newPassword: string): Promise<void> {
        const state = this.newPasswordState;
        if (!state) {
            this.error = "Restart password reset before submitting a new password.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitNewPassword(newPassword);
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("authMethodRegistrationRequired")) {
                this.state = result.state;
                this.selectedRegistrationMethod = null;
                this.registrationContact = "";
                this.code = "";
                this.stopResendCountdown();
            } else if (result.isState("signInContinuation")) {
                await this.continueSignIn(result.state);
            } else {
                this.error = "New password submission returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected password reset error occurred.");
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

    async registerAuthMethod(): Promise<void> {
        const state = this.registrationState;
        const selectedMethod = this.selectedRegistrationMethod;
        if (!state || !selectedMethod) {
            this.error = "Select an authentication method before registering.";
            return;
        }

        const method = state.methods.find((item) => item.type === selectedMethod.type);
        if (!method) {
            this.error = "The selected registration method is no longer available.";
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
                this.state = result.state;
                this.code = "";
                this.stopResendCountdown();
                this.selectedRegistrationMethod = null;
                this.registrationContact = "";
            } else {
                this.error = "Authentication method registration returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected authentication method registration error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async submitRegistrationChallenge(): Promise<void> {
        const state = this.registrationVerificationState;
        if (!state) {
            this.error = "Register an authentication method before submitting its verification code.";
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
                this.code = "";
                this.registrationContact = "";
                this.complete(result.state, result.data);
            } else {
                this.error = "Authentication method verification returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected authentication method verification error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async resendRegistrationChallenge(): Promise<void> {
        const state = this.registrationVerificationState;
        if (!state) {
            this.error = "Register an authentication method before requesting another verification code.";
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
                this.state = result.state;
                this.code = "";
                this.startResendCountdown();
            } else {
                this.error = "Resending the registration code returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected registration code resend error occurred.");
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

    restart(): void {
        if (this.embedded) {
            this.cancel.emit();
            return;
        }

        this.resetFlow();
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
                this.error = "Sign-in after password reset returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected password reset error occurred.");
        } finally {
            this.loading = false;
        }
    }

    private complete(state: CompletedStateV2, account?: CustomAuthAccountData): void {
        this.stopResendCountdown();
        this.state = state;
        this.fieldErrors = {};
        this.userData = account;
        this.completed.emit(account);
    }

    private resetFlow(): void {
        this.stopResendCountdown();
        this.state = null;
        this.userData = undefined;
        this.code = "";
        this.selectedRegistrationMethod = null;
        this.registrationContact = "";
        this.error = "";
        this.fieldErrors = {};
        this.resendCountdown = 0;
        this.initialErrorPresentation = undefined;
    }

    private applyV2Error(error: AuthFlowErrorV2 | null | undefined): V2ErrorPresentation {
        const presentation = getV2ErrorPresentation(error);
        this.error = formatV2ErrorPresentation(presentation);
        this.fieldErrors = getV2FieldErrors(presentation);
        return presentation;
    }

    private startResendCountdown(): void {
        this.stopResendCountdown();
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
