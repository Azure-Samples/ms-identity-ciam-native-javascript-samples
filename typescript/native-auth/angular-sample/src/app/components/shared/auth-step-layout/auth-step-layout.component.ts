import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
    selector: "app-auth-step-layout",
    templateUrl: "./auth-step-layout.component.html",
    standalone: true,
    imports: [CommonModule],
})
export class AuthStepLayoutComponent {
    @Input() title = "";
    @Input() error = "";
    @Input() busy = false;

    @Output() restart = new EventEmitter<void>();
}
