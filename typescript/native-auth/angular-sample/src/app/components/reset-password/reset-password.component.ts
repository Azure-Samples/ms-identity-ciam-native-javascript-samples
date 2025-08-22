import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import {
    ResetPasswordCodeRequiredState,
    ResetPasswordCompletedState,
    ResetPasswordPasswordRequiredState,
    AuthenticationMethod,
    AuthMethodRegistrationRequiredState,
    AuthMethodVerificationRequiredState,
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
    showAuthMethods = false;
    showChallenge = false;
    authMethods: AuthenticationMethod[] = [];
    selectedAuthMethod: AuthenticationMethod | undefined = undefined;
    verificationContact: string | undefined = undefined;
    challenge: string | undefined = undefined;
    isReset = false;
    resetState: any = null;
    isSignedIn = false;
    userData: any = null;
    resendCountdown = 0;

    constructor(private auth: AuthService) {}

    async ngOnInit() {
        const client = await this.auth.getClient();
        const result = client.getCurrentAccount();
        if (result.isCompleted()) {
            this.isSignedIn = true;
            this.showCode = false;
            this.showNewPassword = false;
            this.isReset = false;
            this.userData = result.data;
        }
    }

    async startReset() {
        this.error = "";
        this.loading = true;
        this.isReset = false;
        this.showCode = false;
        this.showNewPassword = false;
        this.showAuthMethods = false;
        this.showChallenge = false;
        this.resetState = null;

        const client = await this.auth.getClient();
        const result = await client.resetPassword({ username: this.email });

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

        this.resetState = result.state;

        if (result.isCodeRequired()) {
            this.showCode = true;
            this.isReset = false;
            this.showNewPassword = false;
            this.showAuthMethods = false;
            this.showChallenge = false;
        }

        this.loading = false;
    }

    async submitCode() {
        this.error = "";
        this.loading = true;
        if (this.resetState instanceof ResetPasswordCodeRequiredState) {
            const result = await this.resetState.submitCode(this.code);

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
                this.isReset = false;
                this.showAuthMethods = false;
                this.showChallenge = false;
                this.resetState = result.state;
            }
        }
        this.loading = false;
    }

    async resendCode() {
        this.error = "";
        this.loading = false;

        if (this.resetState instanceof ResetPasswordCodeRequiredState) {
            const result = await this.resetState.resendCode();

            if (result.isFailed()) {
                this.error = result.error?.errorData?.errorDescription || "An error occurred while resending the code";
            } else {
                this.resendCountdown = 30;

                const timer = setInterval(() => {
                    this.resendCountdown--;
                    if (this.resendCountdown <= 0) {
                        clearInterval(timer);
                        this.resendCountdown = 0;
                    }
                }, 1000);
            }
        }
    }

    async submitNewPassword() {
        this.error = "";
        this.loading = true;
        if (this.resetState instanceof ResetPasswordPasswordRequiredState) {
            const result = await this.resetState.submitNewPassword(this.newPassword);

            if (result.isFailed()) {
                if (result.error?.isInvalidPassword()) {
                    this.error = "Invalid password";
                } else {
                    this.error =
                        result.error?.errorData.errorDescription || "An error occurred while setting new password";
                }
            }

            if (result.isCompleted()) {
                this.isReset = true;
                this.showNewPassword = false;
                this.showCode = false;
                this.showAuthMethods = false;
                this.showChallenge = false;
                this.resetState = result.state;
                this.handleAutoSignIn();
            }
        }
        this.loading = false;
    }

    private async handleAutoSignIn() {
        this.error = "";

        if (this.resetState instanceof ResetPasswordCompletedState) {
            const result = await this.resetState.signIn();

            if (result.isFailed()) {
                this.error = result.error?.errorData?.errorDescription || "An error occurred during auto sign-in";
            }

            if (result.isAuthMethodRegistrationRequired()) {
                this.showAuthMethods = true;
                this.showCode = false;
                this.showNewPassword = false;
                this.showChallenge = false;
                this.isReset = false;
                this.authMethods = result.state.getAuthMethods();
                // Set default selection to the first auth method
                this.selectedAuthMethod = this.authMethods.length > 0 ? this.authMethods[0] : undefined;
                this.resetState = result.state;
            } else if (result.isCompleted()) {
                this.userData = result.data;
                this.resetState = result.state;
                this.isReset = true;
                this.showCode = false;
                this.showNewPassword = false;
                this.showAuthMethods = false;
                this.showChallenge = false;
            }
        }
    }

    async submitAuthMethod() {
        this.error = "";
        this.loading = true;

        if (!this.selectedAuthMethod || !this.verificationContact) {
            this.error = "Please select an authentication method and enter a verification contact.";
            this.loading = false;
            return;
        }

        if (this.resetState instanceof AuthMethodRegistrationRequiredState) {
            const result = await this.resetState.challengeAuthMethod({
                authMethodType: this.selectedAuthMethod,
                verificationContact: this.verificationContact,
            });

            if (result.isFailed()) {
                if (result.error?.isIncorrectVerificationContact()) {
                    this.error = "Incorrect verification contact.";
                } else {
                    this.error =
                        result.error?.errorData?.errorDescription ||
                        "An error occurred while verifying the authentication method";
                }
            }

            if (result.isCompleted()) {
                this.userData = result.data;
                this.showAuthMethods = false;
                this.isReset = true;
                this.resetState = result.state;
            }

            if (result.isVerificationRequired()) {
                this.showAuthMethods = false;
                this.showChallenge = true;
                this.resetState = result.state;
            }
        }
        this.loading = false;
    }

    async submitChallenge() {
        this.error = "";
        this.loading = true;

        if (!this.challenge) {
            this.error = "Please enter a code.";
            this.loading = false;
            return;
        }

        if (this.resetState instanceof AuthMethodVerificationRequiredState) {
            const result = await this.resetState.submitChallenge(this.challenge);

            if (result.isFailed()) {
                if (result.error?.isIncorrectChallenge()) {
                    this.error = "Incorrect code.";
                } else {
                    this.error =
                        result.error?.errorData?.errorDescription ||
                        "An error occurred while verifying the challenge response";
                }
            }

            if (result.isCompleted()) {
                this.userData = result.data;
                this.showChallenge = false;
                this.isReset = true;
                this.resetState = result.state;
            }
        }
        this.loading = false;
    }

    getPlaceholderText(): string {
        if (!this.selectedAuthMethod) {
            return "Enter your contact information";
        }

        const channel = this.selectedAuthMethod.challenge_channel?.toLowerCase();
        if (channel === "email") {
            return "Enter your email for verification";
        } else if (channel === "sms" || channel === "phone") {
            return "Enter your phone number for verification";
        } else {
            return "Enter your contact information for verification";
        }
    }
}
