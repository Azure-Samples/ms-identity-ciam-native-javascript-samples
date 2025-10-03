import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AuthenticationMethod } from "@azure/msal-browser/custom-auth";

@Component({
    selector: "app-mfa-auth-method-selection-form",
    templateUrl: "./mfa-auth-method-selection-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class MfaAuthMethodSelectionFormComponent {
    @Input() authMethods: AuthenticationMethod[] = [];
    @Input() selectedAuthMethod: AuthenticationMethod | undefined;
    @Input() loading = false;
    @Input() title = "Select a verification method to complete multi-factor (second factor) authentication";
    @Input() submitButtonText = "Choose";
    @Input() submitButtonLoadingText = "Loading...";

    @Output() selectedAuthMethodChange = new EventEmitter<AuthenticationMethod | undefined>();
    @Output() submitForm = new EventEmitter<void>();

    onAuthMethodChange(method: AuthenticationMethod | undefined) {
        this.selectedAuthMethodChange.emit(method);
    }

    onSubmit() {
        this.submitForm.emit();
    }
}
