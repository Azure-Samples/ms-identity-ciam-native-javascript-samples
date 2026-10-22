import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-new-password-form",
    templateUrl: "./new-password-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class NewPasswordFormComponent {
    @Input() loading = false;

    @Output() submitPassword = new EventEmitter<string>();

    password = "";

    submit(): void {
        const password = this.password;
        this.password = "";
        this.submitPassword.emit(password);
    }
}
