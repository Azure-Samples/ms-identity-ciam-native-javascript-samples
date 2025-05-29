import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import {
    ResetPasswordCodeRequiredState,
    ResetPasswordPasswordRequiredState,
} from "@azure/msal-browser/custom-auth";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-reset-password",
    templateUrl: "./reset-password.component.html",
    styleUrls: ["./reset-password.component.scss"],
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class ResetPasswordComponent {
    email = "";
    code = "";
    newPassword = "";
    error = "";
    loading = false;
    showCode = false;
    showNewPassword = false;
    isReset = false;
    resetState: any = null;

    constructor(private auth: AuthService) {}

    async startReset() {
        this.error = "";
        this.loading = true;
        this.isReset = false;
        this.showCode = false;
        this.showNewPassword = false;
        this.resetState = null;

        const client = await this.auth.getClient();
        const result = await client.resetPassword({ username: this.email });
        this.resetState = result.state;

        if (result.isFailed()) {
            this.error = result.error?.errorData?.errorDescription || "Password reset failed";
            if (result.error?.isInvalidUsername()) {
                this.error = "Invalid email address";
            } else if (result.error?.isUserNotFound()) {
                this.error = "User not found";
            } else {
                this.error =
                    result.error?.errorData?.errorDescription || "An error occurred while initiating password reset";
            }
        }

        if (result.isCodeRequired()) {
            this.showCode = true;
            this.showNewPassword = false;
        }

        this.loading = false;
    }

    async submitCode() {
        this.error = "";
        this.loading = true;
        if (this.resetState instanceof ResetPasswordCodeRequiredState) {
            const result = await this.resetState.submitCode(this.code);
            this.resetState = result.state;
            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    this.error = "Invalid verification code";
                } else {
                    this.error =
                        result.error?.errorData.errorDescription || "An error occurred while verifying the code";
                }
            }
            if (result.isPasswordRequired()) {
                this.showCode = false;
                this.showNewPassword = true;
            }
        }
        this.loading = false;
    }

    async submitNewPassword() {
        this.error = "";
        this.loading = true;
        if (this.resetState instanceof ResetPasswordPasswordRequiredState) {
            const result = await this.resetState.submitNewPassword(this.newPassword);
            this.resetState = result.state;
            if (result.isFailed()) {
                if (result.error?.isInvalidPassword()) {
                    this.error = "Invalid password";
                } else {
                    this.error = result.error?.errorData.errorDescription || "An error occurred while setting new password";
                }
            }

            if (result.isCompleted()) {
                this.isReset = true;
                this.showNewPassword = false;
            }
        }
        this.loading = false;
    }
}
