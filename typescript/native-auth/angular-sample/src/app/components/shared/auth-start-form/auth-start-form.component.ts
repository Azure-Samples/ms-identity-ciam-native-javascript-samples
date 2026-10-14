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

    @Output() usernameChange = new EventEmitter<string>();
    @Output() passwordChange = new EventEmitter<string>();
    @Output() submitForm = new EventEmitter<void>();
}
