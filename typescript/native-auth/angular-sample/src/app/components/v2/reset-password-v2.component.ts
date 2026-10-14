import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import {
    AuthFlowStateBase,
    AuthMethodSelectionRequiredStateV2,
    CodeRequiredStateV2,
    CompletedStateV2,
    NewPasswordRequiredStateV2,
    SignInContinuationStateV2,
} from "@azure/msal-browser/custom-auth";
import type { CustomAuthAccountData } from "@azure/msal-browser/custom-auth";
import { AuthService } from "../../services/auth.service";
import { AuthStartFormComponent } from "../shared/auth-start-form/auth-start-form.component";
import { AuthStepLayoutComponent } from "../shared/auth-step-layout/auth-step-layout.component";
import { CodeFormComponent } from "../shared/code-form/code-form.component";
import {
    MethodOption,
    MethodSelectionFormComponent,
} from "../shared/method-selection-form/method-selection-form.component";
import { NewPasswordFormComponent } from "../shared/new-password-form/new-password-form.component";
import { getThrownErrorMessage, getV2ErrorMessage } from "./v2-flow-utils";

@Component({
    selector: "app-reset-password-v2",
    templateUrl: "./reset-password-v2.component.html",
    standalone: true,
    imports: [
        CommonModule,
        AuthStartFormComponent,
        AuthStepLayoutComponent,
        CodeFormComponent,
        MethodSelectionFormComponent,
        NewPasswordFormComponent,
    ],
})
export class ResetPasswordV2Component implements OnInit {
    @Input() initialUsername = "";
    @Input() autoStart = false;
    @Input() embedded = false;

    @Output() cancel = new EventEmitter<void>();
    @Output() completed = new EventEmitter<CustomAuthAccountData | undefined>();
    @Output() ready = new EventEmitter<string | undefined>();

    username = "";
    code = "";
    error = "";
    loading = false;
    resendLoading = false;
    resendCountdown = 0;
    state: AuthFlowStateBase | null = null;
    userData: CustomAuthAccountData | undefined;

    constructor(private auth: AuthService) {}

    async ngOnInit(): Promise<void> {
        this.username = this.initialUsername;
        if (this.autoStart) {
            await this.startResetPassword();
        }
        this.ready.emit(this.error || undefined);
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

    async startResetPassword(): Promise<void> {
        this.resetFlow();
        this.loading = true;

        try {
            const client = await this.auth.getClient();
            const result = await client.resetPasswordV2({ username: this.username });
            if (result.isFailed()) {
                this.error = getV2ErrorMessage(result.error);
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
        this.loading = true;
        try {
            const result = await state.selectAuthMethod(method);
            if (result.isFailed()) {
                this.error = getV2ErrorMessage(result.error);
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
        this.loading = true;
        try {
            const result = await state.submitCode(this.code);
            if (result.isFailed()) {
                this.error = getV2ErrorMessage(result.error);
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
        this.resendLoading = true;
        try {
            const result = await state.resendCode();
            if (result.isFailed()) {
                this.error = getV2ErrorMessage(result.error);
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
        this.loading = true;
        try {
            const result = await state.submitNewPassword(newPassword);
            if (result.isFailed()) {
                this.error = getV2ErrorMessage(result.error);
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

    private async continueSignIn(state: SignInContinuationStateV2): Promise<void> {
        this.state = state;
        this.error = "";
        this.loading = true;
        try {
            const result = await state.signIn();
            if (result.isFailed()) {
                this.error = getV2ErrorMessage(result.error);
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
        this.state = state;
        this.userData = account;
        this.completed.emit(account);
    }

    private resetFlow(): void {
        this.state = null;
        this.userData = undefined;
        this.code = "";
        this.error = "";
        this.resendCountdown = 0;
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
