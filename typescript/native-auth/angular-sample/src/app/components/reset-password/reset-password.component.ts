import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import {
    ResetPasswordCodeRequiredState,
    ResetPasswordCompletedState,
    ResetPasswordPasswordRequiredState,
    AuthenticationMethod,
    AuthMethodRegistrationRequiredState,
    AuthMethodVerificationRequiredState,
    MfaAwaitingState,
    MfaVerificationRequiredState,
} from "@azure/msal-browser/custom-auth";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { CodeFormComponent } from "../shared/code-form/code-form.component";
import { AuthMethodSelectionFormComponent } from "../shared/auth-method-selection-form/auth-method-selection-form.component";
import { AuthMethodChallengeFormComponent } from "../shared/auth-method-challenge-form/auth-method-challenge-form.component";
import { MfaAuthMethodSelectionFormComponent } from "../shared/mfa-auth-method-selection-form/mfa-auth-method-selection-form.component";
import { MfaChallengeFormComponent } from "../shared/mfa-challenge-form/mfa-challenge-form.component";

@Component({
    selector: "app-reset-password",
    templateUrl: "./reset-password.component.html",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CodeFormComponent,
        AuthMethodSelectionFormComponent,
        AuthMethodChallengeFormComponent,
        MfaAuthMethodSelectionFormComponent,
        MfaChallengeFormComponent,
    ],
})
export class ResetPasswordComponent {
    username = "";
    code = "";
    newPassword = "";
    error = "";
    loading = false;
    showCode = false;
    showNewPassword = false;
    showAuthMethodsForRegistration = false;
    showChallengeForRegistration = false;
    showMfaAuthMethods = false;
    showMfaChallenge = false;
    authMethodsForRegistration: AuthenticationMethod[] = [];
    selectedAuthMethodForRegistration: AuthenticationMethod | undefined = undefined;
    verificationContactForRegistration: string | undefined = undefined;
    challengeForRegistration: string | undefined = undefined;
    mfaAuthMethods: AuthenticationMethod[] = [];
    selectedMfaAuthMethod: AuthenticationMethod | undefined = undefined;
    mfaChallenge: string | undefined = undefined;
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
        this.showAuthMethodsForRegistration = false;
        this.showChallengeForRegistration = false;
        this.resetState = null;

        const client = await this.auth.getClient();
        const result = await client.resetPassword({ username: this.username });

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
            this.showAuthMethodsForRegistration = false;
            this.showChallengeForRegistration = false;
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
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = false;
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
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = false;
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
                this.showAuthMethodsForRegistration = true;
                this.showCode = false;
                this.showNewPassword = false;
                this.showChallengeForRegistration = false;
                this.showMfaAuthMethods = false;
                this.showMfaChallenge = false;
                this.isReset = false;
                this.authMethodsForRegistration = result.state.getAuthMethods();
                // Set default selection to the first auth method
                this.selectedAuthMethodForRegistration =
                    this.authMethodsForRegistration.length > 0 ? this.authMethodsForRegistration[0] : undefined;
                this.resetState = result.state;
            } else if (result.isMfaRequired()) {
                this.showMfaAuthMethods = true;
                this.showCode = false;
                this.showNewPassword = false;
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = false;
                this.showMfaChallenge = false;
                this.isReset = false;
                this.mfaAuthMethods = result.state.getAuthMethods();
                // Set default selection to the first MFA auth method
                this.selectedMfaAuthMethod = this.mfaAuthMethods.length > 0 ? this.mfaAuthMethods[0] : undefined;
                this.resetState = result.state;
            } else if (result.isCompleted()) {
                this.userData = result.data;
                this.resetState = result.state;
                this.isReset = true;
                this.showCode = false;
                this.showNewPassword = false;
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = false;
                this.showMfaAuthMethods = false;
                this.showMfaChallenge = false;
            }
        }
    }

    async submitAuthMethodForRegistration() {
        this.error = "";
        this.loading = true;

        if (!this.selectedAuthMethodForRegistration || !this.verificationContactForRegistration) {
            this.error = "Please select an authentication method and enter a verification contact.";
            this.loading = false;
            return;
        }

        if (this.resetState instanceof AuthMethodRegistrationRequiredState) {
            const result = await this.resetState.challengeAuthMethod({
                authMethodType: this.selectedAuthMethodForRegistration,
                verificationContact: this.verificationContactForRegistration,
            });

            if (result.isFailed()) {
                if (result.error?.isInvalidInput()) {
                    this.error = "Incorrect verification contact.";
                } else if (result.error?.isVerificationContactBlocked()) {
                    this.error =
                        "The verification contact is blocked. Consider using a different contact or a different authentication method";
                } else {
                    this.error =
                        result.error?.errorData?.errorDescription ||
                        "An error occurred while verifying the authentication method";
                }
            }

            if (result.isCompleted()) {
                this.userData = result.data;
                this.showAuthMethodsForRegistration = false;
                this.isReset = true;
                this.resetState = result.state;
            }

            if (result.isVerificationRequired()) {
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = true;
                this.resetState = result.state;
            }
        }
        this.loading = false;
    }

    async submitChallengeForRegistration() {
        this.error = "";
        this.loading = true;

        if (!this.challengeForRegistration) {
            this.error = "Please enter a code.";
            this.loading = false;
            return;
        }

        if (this.resetState instanceof AuthMethodVerificationRequiredState) {
            const result = await this.resetState.submitChallenge(this.challengeForRegistration);

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
                this.showChallengeForRegistration = false;
                this.isReset = true;
                this.resetState = result.state;
            }
        }
        this.loading = false;
    }

    async submitMfaAuthMethod() {
        this.error = "";
        this.loading = true;

        if (!this.selectedMfaAuthMethod) {
            this.error = "Please select an authentication method.";
            this.loading = false;
            return;
        }

        if (this.resetState instanceof MfaAwaitingState) {
            const result = await this.resetState.requestChallenge(this.selectedMfaAuthMethod.id);

            if (result.isFailed()) {
                if (result.error?.isInvalidInput()) {
                    this.error = "Incorrect verification contact.";
                } else {
                    this.error =
                        result.error?.errorData?.errorDescription ||
                        "An error occurred while verifying the authentication method";
                }
            }

            if (result.isVerificationRequired()) {
                this.showMfaAuthMethods = false;
                this.showMfaChallenge = true;
                this.resetState = result.state;
            }
        }
        this.loading = false;
    }

    async submitMfaChallenge() {
        this.error = "";
        this.loading = true;

        if (!this.mfaChallenge) {
            this.error = "Please enter a code.";
            this.loading = false;
            return;
        }

        if (this.resetState instanceof MfaVerificationRequiredState) {
            const result = await this.resetState.submitChallenge(this.mfaChallenge);

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
                this.showMfaChallenge = false;
                this.isReset = true;
                this.resetState = result.state;
            }
        }
        this.loading = false;
    }

    getPlaceholderTextForVerificationContact(): string {
        if (!this.selectedAuthMethodForRegistration) {
            return "Enter your contact information";
        }

        const channel = this.selectedAuthMethodForRegistration.challenge_channel?.toLowerCase();
        if (channel === "email") {
            return "Enter your email for verification";
        } else if (channel === "sms" || channel === "phone") {
            return "Enter your phone number for verification";
        } else {
            return "Enter your contact information for verification";
        }
    }
}
