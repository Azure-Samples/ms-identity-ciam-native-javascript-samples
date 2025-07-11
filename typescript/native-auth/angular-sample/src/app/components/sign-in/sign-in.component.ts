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
        this.isSignedIn = false;

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
        } else if (result.isCodeRequired()) {
            this.showPassword = false;
            this.showCode = true;
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
}
