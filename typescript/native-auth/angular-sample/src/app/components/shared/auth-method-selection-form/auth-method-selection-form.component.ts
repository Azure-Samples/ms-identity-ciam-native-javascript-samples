import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AuthenticationMethod } from "@azure/msal-browser/custom-auth";

@Component({
    selector: "app-auth-method-selection-form",
    templateUrl: "./auth-method-selection-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class AuthMethodSelectionFormComponent {
    @Input() authMethods: AuthenticationMethod[] = [];
    @Input() selectedAuthMethod: AuthenticationMethod | undefined;
    @Input() verificationContact: string | undefined = "";
    @Input() loading = false;
    @Input() title = "To secure your account, please add an authentication method.";
    @Input() submitButtonText = "Add";
    @Input() submitButtonLoadingText = "Adding...";
    @Input() getPlaceholderText!: () => string;

    @Output() selectedAuthMethodChange = new EventEmitter<AuthenticationMethod | undefined>();
    @Output() verificationContactChange = new EventEmitter<string>();
    @Output() submitForm = new EventEmitter<void>();

    onAuthMethodChange(method: AuthenticationMethod | undefined) {
        this.selectedAuthMethodChange.emit(method);
    }

    onContactChange(value: string) {
        this.verificationContactChange.emit(value);
    }

    onSubmit() {
        this.submitForm.emit();
    }

    getInputType(): string {
        if (!this.selectedAuthMethod) {
            return "text";
        }

        const channel = this.selectedAuthMethod.challenge_channel?.toLowerCase();
        if (channel === "email") {
            return "email";
        } else if (channel === "sms" || channel === "phone") {
            return "tel";
        } else {
            return "text";
        }
    }
}
