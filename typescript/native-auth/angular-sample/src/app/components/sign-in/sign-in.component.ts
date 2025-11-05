import { Component, OnInit } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import {
    SignInPasswordRequiredState,
    SignInCodeRequiredState,
    AuthFlowStateBase,
    CustomAuthAccountData,
    SignInResult,
    SignInCompletedState,
    ICustomAuthPublicClientApplication,
    AuthMethodRegistrationRequiredState,
    AuthenticationMethod,
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
    selector: "app-sign-in",
    templateUrl: "./sign-in.component.html",
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
export class SignInComponent implements OnInit {
    username = "";
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
    isSignedIn = false;
    userData: CustomAuthAccountData | undefined = undefined;
    signInState: AuthFlowStateBase | undefined = undefined;
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

    async startSignIn() {
        this.error = "";
        this.loading = true;
        this.showPassword = false;
        this.showCode = false;
        this.showAuthMethodsForRegistration = false;
        this.isSignedIn = false;
        this.showChallengeForRegistration = false;
        this.showMfaAuthMethods = false;
        this.showMfaChallenge = false;

        const client = await this.auth.getClient();
        const result: SignInResult = await client.signIn({ username: this.username });
        let currentState = result.state;

        if (result.isFailed()) {
            if (result.error?.isUserNotFound()) {
                this.error = "User not found";
            } else if (result.error?.isInvalidUsername()) {
                this.error = "Username is invalid";
            } else if (result.error?.isPasswordIncorrect()) {
                this.error = "Password is invalid";
            } else if (result.error?.isRedirectRequired()) {
                const fallbackResult = await this.authWithFallback(client);
                if (fallbackResult) {
                    const accountResult = client.getCurrentAccount();

                    if (accountResult.isFailed()) {
                        this.error =
                            accountResult.error?.errorData?.errorDescription ??
                            "An error occurred while getting the account from cache";
                    }

                    if (accountResult.isCompleted()) {
                        currentState = new SignInCompletedState();
                        result.data = accountResult.data;
                    }
                }
            } else {
                this.error = result.error?.errorData?.errorDescription || "Sign-in failed";
            }
        }

        if (result.isPasswordRequired()) {
            this.showPassword = true;
            this.showCode = false;
            this.showAuthMethodsForRegistration = false;
            this.showChallengeForRegistration = false;
            this.showMfaAuthMethods = false;
            this.showMfaChallenge = false;
        } else if (result.isCodeRequired()) {
            this.showPassword = false;
            this.showCode = true;
            this.showAuthMethodsForRegistration = false;
            this.showMfaAuthMethods = false;
            this.showMfaChallenge = false;
        } else if (result.isAuthMethodRegistrationRequired()) {
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
            this.signInState = result.state;
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
            this.signInState = result.state;
        } else if (result.isCompleted()) {
            this.isSignedIn = true;
            this.userData = result.data;
        }

        this.signInState = currentState;
        this.loading = false;
    }

    async authWithFallback(client: ICustomAuthPublicClientApplication): Promise<boolean> {
        const popUpRequest: PopupRequest = {
            authority: customAuthConfig.auth.authority,
            scopes: [],
            redirectUri: customAuthConfig.auth.redirectUri || "",
            prompt: "login", // Forces the user to enter their credentials on that request, negating single-sign on.
        };

        try {
            await client.loginPopup(popUpRequest);

            return true;
        } catch (error) {
            if (error instanceof Error) {
                this.error = error.message;
            } else {
                this.error = "An unexpected error occurred while logging in with popup";
            }

            return false;
        }
    }

    async submitPassword() {
        this.error = "";
        this.loading = true;
        if (this.signInState instanceof SignInPasswordRequiredState) {
            const result = await this.signInState.submitPassword(this.password);
            if (result.isFailed()) {
                if (result.error?.isInvalidPassword()) {
                    this.error = "Incorrect password";
                } else {
                    this.error =
                        result.error?.errorData?.errorDescription || "An error occurred while verifying the password";
                }
            }

            if (result.isCompleted()) {
                this.isSignedIn = true;
                this.userData = result.data;
                this.showPassword = false;
                this.signInState = result.state;
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
                this.signInState = result.state;
            }

            if (result.isMfaRequired()) {
                this.showMfaAuthMethods = true;
                this.showPassword = false;
                this.showCode = false;
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = false;
                this.showMfaChallenge = false;
                this.mfaAuthMethods = result.state.getAuthMethods();
                // Set default selection to the first MFA auth method
                this.selectedMfaAuthMethod = this.mfaAuthMethods.length > 0 ? this.mfaAuthMethods[0] : undefined;
                this.signInState = result.state;
            }
        }
        this.loading = false;
    }

    async submitCode() {
        this.error = "";
        this.loading = true;
        if (this.signInState instanceof SignInCodeRequiredState) {
            const result = await this.signInState.submitCode(this.code);

            if (result.isFailed()) {
                if (result.error?.isInvalidCode()) {
                    this.error = "Invalid code";
                } else {
                    this.error =
                        result.error?.errorData?.errorDescription || "An error occurred while verifying the code";
                }
            }

            if (result.isCompleted()) {
                this.isSignedIn = true;
                this.userData = result.data;
                this.showCode = false;
                this.signInState = result.state;
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
                this.signInState = result.state;
            }

            if (result.isMfaRequired()) {
                this.showMfaAuthMethods = true;
                this.showPassword = false;
                this.showCode = false;
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = false;
                this.showMfaChallenge = false;
                this.mfaAuthMethods = result.state.getAuthMethods();
                // Set default selection to the first MFA auth method
                this.selectedMfaAuthMethod = this.mfaAuthMethods.length > 0 ? this.mfaAuthMethods[0] : undefined;
                this.signInState = result.state;
            }
        }
        this.loading = false;
    }

    async submitAuthMethodForRegistration() {
        this.error = "";
        this.loading = true;

        if (!this.selectedAuthMethodForRegistration || !this.verificationContactForRegistration) {
            this.error = "Please select an authentication method and enter a verification contact.";
            this.loading = false;
            return;
        }

        if (this.signInState instanceof AuthMethodRegistrationRequiredState) {
            const result = await this.signInState.challengeAuthMethod({
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
                this.signInState = result.state;
            }

            if (result.isVerificationRequired()) {
                this.showAuthMethodsForRegistration = false;
                this.showChallengeForRegistration = true;
                this.signInState = result.state;
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

        if (this.signInState instanceof AuthMethodVerificationRequiredState) {
            const result = await this.signInState.submitChallenge(this.challengeForRegistration);

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
                this.signInState = result.state;
            }
        }
        this.loading = false;
    }

    async resendCode() {
        this.error = "";

        if (this.signInState instanceof SignInCodeRequiredState) {
            const result = await this.signInState.resendCode();

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

    async submitMfaAuthMethod() {
        this.error = "";
        this.loading = true;

        if (!this.selectedMfaAuthMethod) {
            this.error = "Please select an authentication method.";
            this.loading = false;
            return;
        }

        if (this.signInState instanceof MfaAwaitingState) {
            const result = await this.signInState.requestChallenge(this.selectedMfaAuthMethod.id);

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
                this.signInState = result.state;
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

        if (this.signInState instanceof MfaVerificationRequiredState) {
            const result = await this.signInState.submitChallenge(this.mfaChallenge);

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
                this.signInState = result.state;
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

    async startSignInWithSocial(domainHint: string) {
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
