import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";

export interface MethodOption {
    value: string;
    label: string;
}

@Component({
    selector: "app-method-selection-form",
    templateUrl: "./method-selection-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class MethodSelectionFormComponent implements OnChanges {
    @Input() options: readonly MethodOption[] = [];
    @Input() loading = false;
    @Input() title = "";
    @Input() description = "";
    @Input() submitText = "Choose";
    @Input() submittingText = "Loading...";

    @Output() submitSelection = new EventEmitter<string>();

    selectedValue = "";

    ngOnChanges(changes: SimpleChanges): void {
        if (changes["options"] && !this.options.some((option) => option.value === this.selectedValue)) {
            this.selectedValue = this.options[0]?.value ?? "";
        }
    }

    submit(): void {
        if (this.loading || !this.options.some((option) => option.value === this.selectedValue)) {
            return;
        }

        this.submitSelection.emit(this.selectedValue);
    }
}
