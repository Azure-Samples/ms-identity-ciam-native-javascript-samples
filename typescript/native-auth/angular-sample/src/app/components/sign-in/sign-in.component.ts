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
} from "@azure/msal-browser/custom-auth";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PopupRequest } from "@azure/msal-browser";
import { customAuthConfig } from "../../config/auth-config";

@Component({
    selector: "app-sign-in",
    templateUrl: "./sign-in.component.html",
    styleUrls: ["./sign-in.component.scss"],
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class SignInComponent implements OnInit {
    username = "";
    password = "";
    code = "";
    error = "";
    loading = false;
    showPassword = false;
    showCode = false;
    showAuthMethods = false;
    showChallenge = false;
    authMethods: AuthenticationMethod[] = [];
    selectedAuthMethod: AuthenticationMethod | undefined = undefined;
    verificationContact: string | undefined = undefined;
    challenge: string | undefined = undefined;
    isSignedIn = false;
    userData: CustomAuthAccountData | undefined = undefined;
    signInState: AuthFlowStateBase | undefined = undefined;
    resendCountdown = 0;

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
        this.showAuthMethods = false;
        this.isSignedIn = false;
        this.showChallenge = false;

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
            this.showAuthMethods = false;
            this.showChallenge = false;
        } else if (result.isCodeRequired()) {
            this.showPassword = false;
            this.showCode = true;
            this.showAuthMethods = false;
        } else if (result.isAuthMethodRegistrationRequired()) {
            this.showAuthMethods = true;
            this.showPassword = false;
            this.showCode = false;
            this.showChallenge = false;
            this.authMethods = result.state.getAuthMethods();
            // Set default selection to the first auth method
            this.selectedAuthMethod = this.authMethods.length > 0 ? this.authMethods[0] : undefined;
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
                this.showAuthMethods = true;
                this.showPassword = false;
                this.showCode = false;
                this.showChallenge = false;
                this.authMethods = result.state.getAuthMethods();
                // Set default selection to the first auth method
                this.selectedAuthMethod = this.authMethods.length > 0 ? this.authMethods[0] : undefined;
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
        }
        this.loading = false;
    }

    async submitAuthMethod() {
        this.error = "";
        this.loading = true;

        if (!this.selectedAuthMethod || !this.verificationContact) {
            this.error = "Please select an authentication method and enter a verification contact.";
            this.loading = false;
            return;
        }

        if (this.signInState instanceof AuthMethodRegistrationRequiredState) {
            const result = await this.signInState.challengeAuthMethod({
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
                this.isSignedIn = true;
                this.userData = result.data;
                this.showAuthMethods = false;
                this.signInState = result.state;
            }

            if (result.isVerificationRequired()) {
                this.showAuthMethods = false;
                this.showChallenge = true;
                this.signInState = result.state;
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

        if (this.signInState instanceof AuthMethodVerificationRequiredState) {
            const result = await this.signInState.submitChallenge(this.challenge);

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
                this.showChallenge = false;
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
