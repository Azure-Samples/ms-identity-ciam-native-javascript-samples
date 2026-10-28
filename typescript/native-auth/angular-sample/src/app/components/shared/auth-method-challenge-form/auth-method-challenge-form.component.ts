import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-auth-method-challenge-form",
    templateUrl: "./auth-method-challenge-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class AuthMethodChallengeFormComponent {
    @Input() challenge: string | undefined = "";
    @Input() loading = false;
    @Input() title = "Enter the code below to verify your method";
    @Input() placeholder = "Enter verification code";
    @Input() submitButtonText = "Verify Code";
    @Input() submitButtonLoadingText = "Verifying...";

    @Output() challengeChange = new EventEmitter<string>();
    @Output() submitForm = new EventEmitter<void>();

    onChallengeChange(value: string) {
        this.challengeChange.emit(value);
    }

    onSubmit() {
        this.submitForm.emit();
    }
}
