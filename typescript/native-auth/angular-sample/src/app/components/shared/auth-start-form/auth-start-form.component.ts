import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-auth-start-form",
    templateUrl: "./auth-start-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class AuthStartFormComponent {
    @Input() username = "";
    @Input() password = "";
    @Input() loading = false;
    @Input() showPassword = true;
    @Input() usernamePlaceholder = "Email or Username";
    @Input() submitText = "Continue";
    @Input() submittingText = "Loading...";
    @Input() helperText = "";
    @Input() fieldErrors: Readonly<Record<string, string>> = {};

    @Output() usernameChange = new EventEmitter<string>();
    @Output() passwordChange = new EventEmitter<string>();
    @Output() fieldChange = new EventEmitter<string>();
    @Output() submitForm = new EventEmitter<void>();

    onUsernameChange(value: string): void {
        this.fieldChange.emit("username");
        this.usernameChange.emit(value);
    }

    onPasswordChange(value: string): void {
        this.fieldChange.emit("password");
        this.passwordChange.emit(value);
    }

    get usernameError(): string | undefined {
        return this.fieldErrors["username"];
    }

    get passwordError(): string | undefined {
        return this.fieldErrors["password"];
    }
}
