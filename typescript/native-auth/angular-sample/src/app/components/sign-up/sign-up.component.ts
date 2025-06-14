import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import {
    SignUpPasswordRequiredState,
    SignUpCodeRequiredState,
    UserAccountAttributes,
} from "@azure/msal-browser/custom-auth";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: "app-sign-up",
    templateUrl: "./sign-up.component.html",
    styleUrls: ["./sign-up.component.scss"],
    standalone: true,
    imports: [CommonModule, FormsModule]
})
export class SignUpComponent {
    firstName = "";
    lastName = "";
    jobTitle = "";
    city = "";
    country = "";
    email = "";
    password = "";
    code = "";
    error = "";
    loading = false;
    showPassword = false;
    showCode = false;
    isSignedUp = false;
    isSignedIn = false;
    userData: any = null;
    signUpState: any = null;

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
        const attributes = new UserAccountAttributes();
        attributes.setGivenName(this.firstName);
        attributes.setSurname(this.lastName);
        attributes.setJobTitle(this.jobTitle);
        attributes.setCity(this.city);
        attributes.setCountry(this.country);

        const result = await client.signUp({
            username: this.email,
            attributes,
        });

        if (result.isFailed()) {
            if (result.error?.isUserAlreadyExists()) {
                this.error = "An account with this email already exists";
            } else if (result.error?.isInvalidUsername()) {
                this.error = "Invalid uername";
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
                    this.error = result.error?.errorData.errorDescription || "An error occurred while submitting the password";
                }
            }

            if (result.isCompleted()) {
                this.isSignedUp = true;
                this.showPassword = false;
                this.showCode = false;
                this.signUpState = result.state;
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
                    this.error = result.error?.errorData.errorDescription || "An error occurred while verifying the code";
                }
            }

            if (result.isCompleted()) {
                this.isSignedUp = true;
                this.showCode = false;
                this.showPassword = false;
                this.signUpState = result.state;
            } else if (result.isPasswordRequired()) {
                this.showCode = false;
                this.showPassword = true;
                this.signUpState = result.state;
            }
        }
        this.loading = false;
    }
}
