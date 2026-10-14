import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";

export interface AttributeField {
    name: string;
    label: string;
    required: boolean;
    inputType: "text" | "password";
    pattern?: string;
}

export interface AttributeValueChange {
    name: string;
    value: string;
}

@Component({
    selector: "app-dynamic-attributes-form",
    templateUrl: "./dynamic-attributes-form.component.html",
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class DynamicAttributesFormComponent {
    @Input() fields: readonly AttributeField[] = [];
    @Input() values: Readonly<Record<string, string>> = {};
    @Input() loading = false;
    @Input() fieldsOnly = false;

    @Output() valueChange = new EventEmitter<AttributeValueChange>();
    @Output() submitForm = new EventEmitter<void>();

    onValueChange(name: string, event: Event): void {
        const input = event.target;
        if (input instanceof HTMLInputElement) {
            this.valueChange.emit({ name, value: input.value });
        }
    }

    trackFieldByName(_index: number, field: AttributeField): string {
        return field.name;
    }
}
