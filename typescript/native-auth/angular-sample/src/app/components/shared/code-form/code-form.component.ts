import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-code-form",
    templateUrl: "./code-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class CodeFormComponent {
    @Input() code = "";
    @Input() loading = false;
    @Input() resendCountdown = 0;
    @Input() placeholder = "OTP Code";
    @Input() submitButtonText = "Verify Code";
    @Input() submitButtonLoadingText = "Verifying...";
    @Input() sentTo: string | undefined;
    @Input() channel: string | undefined;
    @Input() codeLength: number | undefined;
    @Input() showDeliveryHint = false;
    @Input() resendLoading = false;
    @Input() noValidate = false;
    @Input() disableResendWhileLoading = false;

    @Output() codeChange = new EventEmitter<string>();
    @Output() submitForm = new EventEmitter<void>();
    @Output() resend = new EventEmitter<void>();

    onCodeChange(value: string) {
        this.codeChange.emit(value);
    }

    onSubmit() {
        this.submitForm.emit();
    }

    onResendClick() {
        this.resend.emit();
    }
}
