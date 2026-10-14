import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { PopupRequest } from "@azure/msal-browser";
import type { CustomAuthAccountData } from "@azure/msal-browser/custom-auth";
import { customAuthConfig } from "../../config/auth-config";
import { AuthService } from "../../services/auth.service";
import { ResetPasswordComponent } from "../v1/reset-password.component";
import { SignInComponent } from "../v1/sign-in.component";
import { SignUpComponent } from "../v1/sign-up.component";
import { ResetPasswordV2Component } from "../v2/reset-password-v2.component";
import { SignInV2Component } from "../v2/sign-in-v2.component";
import { SignUpV2Component } from "../v2/sign-up-v2.component";

type AuthVersion = "v1" | "v2";
type AuthAction = "signIn" | "signUp" | "resetPassword";

interface ActiveFlow {
    version: AuthVersion;
    action: AuthAction;
    username: string;
    password?: string;
}

@Component({
    selector: "app-unified-auth",
    templateUrl: "./unified-auth.component.html",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SignInComponent,
        SignUpComponent,
        ResetPasswordComponent,
        SignInV2Component,
        SignUpV2Component,
        ResetPasswordV2Component,
    ],
})
export class UnifiedAuthComponent implements OnInit {
    version: AuthVersion = "v2";
    username = "";
    password = "";
    error = "";
    loading = true;
    flowStarting = false;
    startingAction: AuthAction | undefined;
    account: CustomAuthAccountData | undefined;
    activeFlow: ActiveFlow | undefined;

    readonly socialProviders = [
        { name: "Google", domainHint: "Google", logo: "/logos/google.svg" },
        { name: "Facebook", domainHint: "Facebook", logo: "/logos/facebook.svg" },
        { name: "Apple", domainHint: "Apple", logo: "/logos/apple.svg" },
        { name: "LinkedIn", domainHint: "www.linkedin.com", logo: "/logos/linkedin.svg" },
    ];

    constructor(private auth: AuthService) {}

    async ngOnInit(): Promise<void> {
        try {
            const client = await this.auth.getClient();
            const accountResult = client.getCurrentAccount();
            if (accountResult.isFailed()) {
                this.error =
                    accountResult.error?.errorData.errorDescription ||
                    "An error occurred while reading the current account.";
            }
            if (accountResult.isCompleted()) {
                this.account = accountResult.data;
                this.auth.setCurrentAccount(accountResult.data);
            }
        } catch (error) {
            this.error = this.getThrownErrorMessage(error);
        } finally {
            this.loading = false;
        }
    }

    changeVersion(version: AuthVersion): void {
        this.version = version;
        this.activeFlow = undefined;
        this.error = "";
    }

    startFlow(action: AuthAction): void {
        const username = this.username.trim();
        if (!username) {
            this.error = "Enter an email address.";
            return;
        }

        this.error = "";
        this.flowStarting = true;
        this.startingAction = action;
        this.activeFlow = {
            version: this.version,
            action,
            username,
            ...(action !== "resetPassword" && this.password ? { password: this.password } : {}),
        };
        this.password = "";
    }

    cancelFlow(): void {
        this.activeFlow = undefined;
        this.flowStarting = false;
        this.startingAction = undefined;
        this.username = "";
        this.password = "";
        this.error = "";
    }

    async completeFlow(account?: CustomAuthAccountData): Promise<void> {
        this.flowStarting = false;
        this.startingAction = undefined;
        this.error = "";

        if (account) {
            this.finishFlow(account);
            return;
        }

        try {
            const client = await this.auth.getClient();
            const accountResult = client.getCurrentAccount();
            const isCompleted = accountResult.isCompleted();
            const isFailed = accountResult.isFailed();
            const accountData = accountResult.data;
            const errorDescription = accountResult.error?.errorData.errorDescription;

            if (isCompleted && accountData) {
                this.finishFlow(accountData);
                return;
            }
            if (isFailed) {
                this.error = errorDescription || "Authentication completed, but the account could not be read.";
                return;
            }
            this.error = "Authentication completed, but no account was returned.";
        } catch (error) {
            this.error = this.getThrownErrorMessage(error);
        }
    }

    showActiveFlow(initialError?: string): void {
        this.flowStarting = false;
        this.startingAction = undefined;

        if (initialError) {
            this.activeFlow = undefined;
            this.error = initialError;
        }
    }

    async continueWithProvider(domainHint: string): Promise<void> {
        this.error = "";
        this.loading = true;
        try {
            const client = await this.auth.getClient();
            const request: PopupRequest = {
                authority: customAuthConfig.auth.authority,
                scopes: [],
                redirectUri: customAuthConfig.auth.redirectUri || "",
                prompt: "login",
                domainHint,
            };
            await client.loginPopup(request);

            const accountResult = client.getCurrentAccount();
            if (accountResult.isFailed()) {
                this.error =
                    accountResult.error?.errorData.errorDescription ||
                    "An error occurred while getting the account from the cache.";
            }
            if (accountResult.isCompleted()) {
                this.account = accountResult.data;
                this.auth.setCurrentAccount(accountResult.data);
            }
        } catch (error) {
            this.error = this.getThrownErrorMessage(error);
        } finally {
            this.loading = false;
        }
    }

    private getThrownErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : "An unexpected authentication error occurred.";
    }

    private finishFlow(account: CustomAuthAccountData): void {
        this.activeFlow = undefined;
        this.username = "";
        this.password = "";
        this.error = "";
        this.account = account;
        this.auth.setCurrentAccount(account);
    }
}
