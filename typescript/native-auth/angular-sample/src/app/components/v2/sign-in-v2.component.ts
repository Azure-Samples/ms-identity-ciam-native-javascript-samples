import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
    type AuthFlowErrorV2,
    AuthFlowStateBase,
    type AuthenticationMethodRegistrationV2,
    AuthMethodRegistrationRequiredStateV2,
    AuthMethodSelectionRequiredStateV2,
    AuthMethodVerificationRequiredStateV2,
    CodeRequiredStateV2,
    CompletedStateV2,
    MFAVerificationRequiredStateV2,
    PasswordRequiredStateV2,
} from "@azure/msal-browser/custom-auth";
import type { CustomAuthAccountData } from "@azure/msal-browser/custom-auth";
import { AuthService } from "../../services/auth.service";
import { authorizationInputs } from "../../config/authorization-request-config";
import { AuthStartFormComponent } from "../shared/auth-start-form/auth-start-form.component";
import { AuthStepLayoutComponent } from "../shared/auth-step-layout/auth-step-layout.component";
import { CodeFormComponent } from "../shared/code-form/code-form.component";
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

@Component({
    selector: "app-sign-in-v2",
    templateUrl: "./sign-in-v2.component.html",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        AuthStartFormComponent,
        AuthStepLayoutComponent,
        CodeFormComponent,
        MethodSelectionFormComponent,
        PasswordFormComponent,
    ],
})
export class SignInV2Component implements OnInit {
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
            await this.startSignIn();
        }
        this.ready.emit(
            this.initialErrorPresentation ??
                (this.error ? createV2ErrorPresentation(this.error) : undefined),
        );
    }

    get passwordState(): PasswordRequiredStateV2 | null {
        return this.state instanceof PasswordRequiredStateV2 ? this.state : null;
    }

    get codeState(): CodeRequiredStateV2 | null {
        return this.state instanceof CodeRequiredStateV2 ? this.state : null;
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

    async startSignIn(): Promise<void> {
        this.resetFlow();
        this.loading = true;

        try {
            const client = await this.auth.getClient();
            const result = await client.signInV2({
                username: this.username,
                password: this.password || undefined,
                ...authorizationInputs,
            });

            if (result.isFailed()) {
                this.initialErrorPresentation = this.applyV2Error(result.error);
            } else if (
                result.isState("passwordRequired") ||
                result.isState("codeRequired") ||
                result.isState("authMethodSelectionRequired") ||
                result.isState("authMethodRegistrationRequired")
            ) {
                this.state = result.state;
            } else if (result.isState("completed")) {
                this.complete(result.state, result.data);
            } else {
                this.error = "Sign-in returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-in error occurred.");
        } finally {
            this.password = "";
            this.loading = false;
        }
    }

    async submitPassword(password: string): Promise<void> {
        const state = this.passwordState;
        if (!state) {
            this.error = "Restart sign-in before submitting a password.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitPassword(password);
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("completed")) {
                this.complete(result.state, result.data);
            } else if (result.isState("authMethodSelectionRequired")) {
                this.state = result.state;
            } else if (result.isState("authMethodRegistrationRequired")) {
                this.state = result.state;
            } else {
                this.error = "Password submission returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-in error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async submitCode(): Promise<void> {
        const state = this.codeState;
        if (!state) {
            this.error = "Restart sign-in before submitting a verification code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.loading = true;
        try {
            const result = await state.submitCode(this.code);
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else if (result.isState("completed")) {
                this.complete(result.state, result.data);
            } else if (result.isState("authMethodSelectionRequired")) {
                this.code = "";
                this.state = result.state;
            } else if (result.isState("authMethodRegistrationRequired")) {
                this.code = "";
                this.state = result.state;
            } else {
                this.error = "Code verification returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-in error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async selectAuthMethod(methodId: string): Promise<void> {
        const state = this.methodSelectionState;
        if (!state) {
            this.error = "Restart sign-in before selecting an authentication method.";
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
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else {
                this.code = "";
                this.state = result.state;
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-in error occurred.");
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
            const result = await state.enrollAuthMethod(method, contact);
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
            this.error = "Restart sign-in before submitting an activation code.";
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
            this.error = "Restart sign-in before requesting another activation code.";
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

    async submitMfaCode(): Promise<void> {
        const state = this.mfaVerificationState;
        if (!state) {
            this.error = "Restart sign-in before submitting an MFA code.";
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
                this.error = "MFA verification returned an unsupported state.";
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-in error occurred.");
        } finally {
            this.loading = false;
        }
    }

    async resendCode(): Promise<void> {
        const state = this.codeState;
        if (!state) {
            this.error = "Restart sign-in before requesting another code.";
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
            this.error = getThrownErrorMessage(error, "An unexpected sign-in error occurred.");
        } finally {
            this.resendLoading = false;
        }
    }

    async resendMfaCode(): Promise<void> {
        const state = this.mfaVerificationState;
        if (!state) {
            this.error = "Restart sign-in before requesting another MFA code.";
            return;
        }

        this.error = "";
        this.fieldErrors = {};
        this.resendLoading = true;
        try {
            const result = await state.resendChallenge();
            if (result.isFailed()) {
                this.applyV2Error(result.error);
            } else {
                this.code = "";
                this.state = result.state;
                this.startResendCountdown();
            }
        } catch (error) {
            this.error = getThrownErrorMessage(error, "An unexpected sign-in error occurred.");
        } finally {
            this.resendLoading = false;
        }
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

    private applyV2Error(error: AuthFlowErrorV2 | null | undefined): V2ErrorPresentation {
        const presentation = getV2ErrorPresentation(error);
        this.error = formatV2ErrorPresentation(presentation);
        this.fieldErrors = getV2FieldErrors(presentation);
        return presentation;
    }

    private complete(state: CompletedStateV2, account?: CustomAuthAccountData): void {
        this.state = state;
        this.code = "";
        this.fieldErrors = {};
        this.userData = account;
        this.completed.emit(account);
    }

    private resetFlow(): void {
        this.state = null;
        this.userData = undefined;
        this.code = "";
        this.registrationContact = "";
        this.selectedRegistrationMethod = null;
        this.error = "";
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
