import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-password-form",
    templateUrl: "./password-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class PasswordFormComponent {
    @Input() password = "";
    @Input() loading = false;
    @Input() placeholder = "Password";
    @Input() submitButtonText = "Submit Password";
    @Input() submitButtonLoadingText = "Submitting...";

    @Output() passwordChange = new EventEmitter<string>();
    @Output() submitForm = new EventEmitter<void>();

    onPasswordChange(value: string) {
        this.passwordChange.emit(value);
    }

    onSubmit() {
        this.submitForm.emit();
    }
}
