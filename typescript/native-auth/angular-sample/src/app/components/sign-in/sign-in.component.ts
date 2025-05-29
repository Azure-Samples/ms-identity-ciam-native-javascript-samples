import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import {
    SignInPasswordRequiredState,
    SignInCodeRequiredState,
    AuthFlowStateBase,
    CustomAuthAccountData,
} from "@azure/msal-browser/custom-auth";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-sign-in",
    templateUrl: "./sign-in.component.html",
    styleUrls: ["./sign-in.component.scss"],
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class SignInComponent {
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

    constructor(private auth: AuthService) {}

    async startSignIn() {
        this.error = "";
        this.loading = true;
        this.showPassword = false;
        this.showCode = false;
        this.isSignedIn = false;

        const client = await this.auth.getClient();
        const result = await client.signIn({ username: this.username });
        this.signInState = result.state;

        if (result.isFailed()) {
            if (result.error?.isUserNotFound()) {
                this.error = "User not found";
            } else if (result.error?.isInvalidUsername()) {
                this.error = "Username is invalid";
            } else if (result.error?.isPasswordIncorrect()) {
                this.error = "Password is invalid";
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

        this.loading = false;
    }

    async submitPassword() {
        this.error = "";
        this.loading = true;
        if (this.signInState instanceof SignInPasswordRequiredState) {
            const result = await this.signInState.submitPassword(this.password);
            this.signInState = result.state;
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
            }
        }
        this.loading = false;
    }

    async submitCode() {
        this.error = "";
        this.loading = true;
        if (this.signInState instanceof SignInCodeRequiredState) {
            const result = await this.signInState.submitCode(this.code);
            this.signInState = result.state;
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
            }
        }
        this.loading = false;
    }
}
