import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import {
    SignUpPasswordRequiredState,
    SignUpCodeRequiredState,
    SignUpCompletedState,
    UserAccountAttributes,
    AuthenticationMethod,
    AuthMethodRegistrationRequiredState,
    AuthMethodVerificationRequiredState,
    MfaAwaitingState,
    MfaVerificationRequiredState,
} from "@azure/msal-browser/custom-auth";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PopupRequest } from "@azure/msal-browser";
import { customAuthConfig } from "../../config/auth-config";
import { CodeFormComponent } from "../shared/code-form/code-form.component";
import { PasswordFormComponent } from "../shared/password-form/password-form.component";
import { AuthMethodSelectionFormComponent } from "../shared/auth-method-selection-form/auth-method-selection-form.component";
import { AuthMethodChallengeFormComponent } from "../shared/auth-method-challenge-form/auth-method-challenge-form.component";
import { MfaAuthMethodSelectionFormComponent } from "../shared/mfa-auth-method-selection-form/mfa-auth-method-selection-form.component";
import { MfaChallengeFormComponent } from "../shared/mfa-challenge-form/mfa-challenge-form.component";

@Component({
    selector: "app-sign-up",
    templateUrl: "./sign-up.component.html",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CodeFormComponent,
        PasswordFormComponent,
        AuthMethodSelectionFormComponent,
        AuthMethodChallengeFormComponent,
        MfaAuthMethodSelectionFormComponent,
        MfaChallengeFormComponent,
    ],
})
export class SignUpComponent {
    firstName = "";
    lastName = "";
    jobTitle = "";
    city = "";
    country = "";
    email = "";
    flatUsername = "";
    password = "";
    code = "";
    error = "";
    loading = false;
    showPassword = false;
    showCode = false;
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
    isSignedUp = false;
    isSignedIn = false;
    userData: any = null;
    signUpState: any = null;
    resendCountdown = 0;

    socialProviders = [
        { name: "Google", domainHint: "Google", logo: "/logos/google.svg" },
        { name: "Facebook", domainHint: "Facebook", logo: "/logos/facebook.svg" },
        { name: "Apple", domainHint: "Apple", logo: "/logos/apple.svg" },
        { name: "LinkedIn", domainHint: "www.linkedin.com", logo: "/logos/linkedin.svg" },
    ];

    constructor(private auth: AuthService) {}

    async ngOnInit() {
        const client = await this.auth.getClient();
        const result = client.getCurrentAccount();
        if (result.isCompleted()) {
            this.isSignedIn = true;
            this.showCode = false;
            this.showPassword = false;
            this.userData = result.data;
        }
    }

    async startSignUp() {
        this.error = "";
        this.loading = true;
        this.isSignedUp = false;
        this.showPassword = false;
        this.showCode = false;
        this.signUpState = null;

        const client = await this.auth.getClient();
        const attributes: UserAccountAttributes = {
            displayName: this.firstName || this.lastName,
            givenName: this.firstName,
            surname: this.lastName,
            jobTitle: this.jobTitle,
            city: this.city,
            country: this.country,
            flatusername: this.flatUsername,
        };

        const result = await client.signUp({
            username: this.email,
            attributes,
        });

        if (result.isFailed()) {
            if (result.error?.isUserAlreadyExists()) {
                this.error = "An account with this email or username already exists";
            } else if (result.error?.isInvalidUsername()) {
                this.error = "Invalid username";
            } else if (result.error?.isInvalidPassword()) {
                this.error = "Invalid password";
            } else if (result.error?.isAttributesValidationFailed()) {
                this.error = "Invalid attributes";
            } else if (result.error?.isMissingRequiredAttributes()) {
                this.error = "Missing required attributes";
            } else {
                this.error = result.error?.errorData.errorDescription || "An error occurred while signing up";
            }
        }

        this.signUpState = result.state;

        if (result.isPasswordRequired()) {
            this.showPassword = true;
            this.showCode = false;
        } else if (result.isCodeRequired()) {
            this.showPassword = false;
            this.showCode = true;
        }

        this.loading = false;
    }

    async submitPassword() {
        this.error = "";
        this.loading = true;
        if (this.signUpState instanceof SignUpPasswordRequiredState) {
            const result = await this.signUpState.submitPassword(this.password);

            if (result.isFailed()) {
                if (result.error?.isInvalidPassword()) {
                    this.error = "Invalid password";
                } else {
                    this.error =
                        result.error?.errorData.errorDescription || "An error occurred while submitting the password";
                }
            }

            if (result.isCompleted()) {
                this.isSignedUp = true;
                this.showPassword = false;
                this.showCode = false;
                this.signUpState = result.state;
                this.handleAutoSignIn();
            }
        }
        this.loading = false;
    }

    async submitCode() {
        this.error = "";
        this.loading = true;
        if (this.signUpState instanceof SignUpCodeRequiredState) {
            const result = await this.signUpState.submitCode(this.code);

            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    this.error = "Invalid verification code";
                } else {
                    this.error =
                        result.error?.errorData.errorDescription || "An error occurred while verifying the code";
                }
            }

            if (result.isCompleted()) {
                this.isSignedUp = true;
                this.showCode = false;
                this.showPassword = false;
                this.signUpState = result.state;
                this.handleAutoSignIn();
            } else if (result.isPasswordRequired()) {
                this.showCode = false;
                this.showPassword = true;
                this.signUpState = result.state;
            }
        }
        this.loading = false;
    }

    async resendCode() {
        this.error = "";
        this.loading = false;

        if (this.signUpState instanceof SignUpCodeRequiredState) {
            const result = await this.signUpState.resendCode();

            if (result.isFailed()) {
                this.error = result.error?.errorData.errorDescription || "An error occurred while resending the code";
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

    async submitAuthMethodForRegistration() {
        this.error = "";
        this.loading = true;

        if (!this.selectedAuthMethodForRegistration || !this.verificationContactForRegistration) {
            this.error = "Please select an authentication method and enter a verification contact.";
            this.loading = false;
            return;
        }

        if (this.signUpState instanceof AuthMethodRegistrationRequiredState) {
            const result = await this.signUpState.challengeAuthMethod({
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
                this.isSignedIn = true;
                this.userData = result.data;
                this.showAuthMethodsForRegistration = false;
                this.signUpState = result.state;
            }

            if (result.isVerificationRequired()) {
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = true;
                this.signUpState = result.state;
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

        if (this.signUpState instanceof AuthMethodVerificationRequiredState) {
            const result = await this.signUpState.submitChallenge(this.challengeForRegistration);

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
                this.isSignedIn = true;
                this.userData = result.data;
                this.showChallengeForRegistration = false;
                this.signUpState = result.state;
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

        if (this.signUpState instanceof MfaAwaitingState) {
            const result = await this.signUpState.requestChallenge(this.selectedMfaAuthMethod.id);

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
                this.signUpState = result.state;
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

        if (this.signUpState instanceof MfaVerificationRequiredState) {
            const result = await this.signUpState.submitChallenge(this.mfaChallenge);

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
                this.isSignedIn = true;
                this.userData = result.data;
                this.showMfaChallenge = false;
                this.signUpState = result.state;
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

    private async handleAutoSignIn() {
        this.error = "";

        if (this.signUpState instanceof SignUpCompletedState) {
            const result = await this.signUpState.signIn();

            if (result.isFailed()) {
                this.error = result.error?.errorData?.errorDescription || "An error occurred during auto sign-in";
            }

            if (result.isAuthMethodRegistrationRequired()) {
                this.showAuthMethodsForRegistration = true;
                this.showPassword = false;
                this.showCode = false;
                this.showChallengeForRegistration = false;
                this.showMfaAuthMethods = false;
                this.showMfaChallenge = false;
                this.authMethodsForRegistration = result.state.getAuthMethods();
                // Set default selection to the first auth method
                this.selectedAuthMethodForRegistration =
                    this.authMethodsForRegistration.length > 0 ? this.authMethodsForRegistration[0] : undefined;
                this.signUpState = result.state;
            } else if (result.isMfaRequired()) {
                this.showMfaAuthMethods = true;
                this.showPassword = false;
                this.showCode = false;
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = false;
                this.showMfaChallenge = false;
                this.mfaAuthMethods = result.state.getAuthMethods();
                // Set default selection to the first MFA auth method
                this.selectedMfaAuthMethod = this.mfaAuthMethods.length > 0 ? this.mfaAuthMethods[0] : undefined;
                this.signUpState = result.state;
            } else if (result.isCompleted()) {
                this.userData = result.data;
                this.signUpState = result.state;
                this.isSignedUp = true;
                this.showCode = false;
                this.showPassword = false;
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = false;
                this.showMfaAuthMethods = false;
                this.showMfaChallenge = false;
            }
        }
    }

    async startSignUpWithSocial(domainHint: string) {
        this.error = "";
        this.loading = false;

        const popUpRequest: PopupRequest = {
            authority: customAuthConfig.auth.authority,
            scopes: [],
            redirectUri: customAuthConfig.auth.redirectUri || "",
            prompt: "login",
            domainHint: domainHint,
        };

        try {
            const client = await this.auth.getClient();

            await client.loginPopup(popUpRequest);

            const accountResult = client.getCurrentAccount();

            if (accountResult.isFailed()) {
                this.error =
                    accountResult.error?.errorData?.errorDescription ??
                    "An error occurred while getting the account from cache";
            }

            if (accountResult.isCompleted()) {
                this.userData = accountResult.data;
                this.isSignedIn = true;
            }
        } catch (error) {
            if (error instanceof Error) {
                this.error = error.message;
            } else {
                this.error = "An unexpected error occurred while logging in with popup";
            }
        }
    }
}
