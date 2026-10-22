import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
    AuthMethodRegistrationRequiredStateV2,
    AuthMethodVerificationRequiredStateV2,
    CompletedStateV2,
    CustomAuthResultV2,
    type AuthenticationMethodRegistrationV2,
} from "@azure/msal-browser/custom-auth";
import { AuthService } from "../../services/auth.service";
import { ResetPasswordV2Component } from "./reset-password-v2.component";

describe("ResetPasswordV2Component JIT enrollment", () => {
    const methods: AuthenticationMethodRegistrationV2[] = [
        { type: "email", enrollHref: "/enroll/email" },
        { type: "phone", channels: ["sms"], enrollHref: "/enroll/phone" },
    ];
    let fixture: ComponentFixture<ResetPasswordV2Component>;
    let component: ResetPasswordV2Component;
    let element: HTMLElement;
    let registration: jasmine.SpyObj<AuthMethodRegistrationRequiredStateV2>;
    let activation: jasmine.SpyObj<AuthMethodVerificationRequiredStateV2>;
    let refreshedActivation: jasmine.SpyObj<AuthMethodVerificationRequiredStateV2>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ResetPasswordV2Component],
            providers: [
                { provide: AuthService, useValue: jasmine.createSpyObj<AuthService>("AuthService", ["getClient"]) },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ResetPasswordV2Component);
        component = fixture.componentInstance;
        element = fixture.nativeElement;
        registration = jasmine.createSpyObj<AuthMethodRegistrationRequiredStateV2>(
            "RegistrationState",
            ["enrollAuthMethod"],
            { stateType: "authMethodRegistrationRequired", methods },
        );
        activation = jasmine.createSpyObj<AuthMethodVerificationRequiredStateV2>(
            "ActivationState",
            ["submitChallenge", "resendChallenge"],
            {
                stateType: "authMethodVerificationRequired",
                method: methods[1],
                sentTo: "+1******0100",
                codeLength: 6,
            },
        );
        refreshedActivation = jasmine.createSpyObj<AuthMethodVerificationRequiredStateV2>(
            "RefreshedActivationState",
            ["submitChallenge", "resendChallenge"],
            {
                stateType: "authMethodVerificationRequired",
                method: methods[1],
                sentTo: "+1******0100",
                codeLength: 8,
            },
        );
        spyOnProperty(component, "registrationState", "get").and.callFake(
            () => component.state === registration ? registration : null,
        );
        spyOnProperty(component, "registrationVerificationState", "get").and.callFake(() => {
            if (component.state === activation) {
                return activation;
            }
            return component.state === refreshedActivation ? refreshedActivation : null;
        });
        component.state = registration;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => fixture.destroy());

    it("shows method selection before requesting a contact", () => {
        expect(component.registrationMethodOptions).toEqual([
            { value: "email", label: "email" },
            { value: "phone", label: "phone (sms)" },
        ]);
        expect(element.querySelector("app-method-selection-form")).not.toBeNull();
        expect(element.querySelector("#reset-registration-contact")).toBeNull();
        expect(element.textContent).toContain("Continue");
    });

    it("shows the selected contact form and lets the user choose another method", () => {
        component.selectRegistrationMethod("phone");
        fixture.detectChanges();

        const input = element.querySelector<HTMLInputElement>("#reset-registration-contact");
        expect(input?.type).toBe("tel");
        expect(input?.autocomplete).toBe("tel");
        expect(element.textContent).toContain("Phone number (with country code)");
        expect(element.textContent).toContain("Register method");
        expect(element.querySelector("app-method-selection-form")).toBeNull();

        element.querySelector<HTMLButtonElement>("form button[type='button']")?.click();
        fixture.detectChanges();
        expect(element.querySelector("app-method-selection-form")).not.toBeNull();
        expect(element.querySelector("#reset-registration-contact")).toBeNull();
    });

    it("clears the previous contact and errors when switching to email", () => {
        component.selectRegistrationMethod("phone");
        component.registrationContact = "+15555550100";
        component.error = "Previous registration error";
        component.fieldErrors = { verificationcontact: "Invalid contact" };
        component.selectRegistrationMethod("email");
        fixture.detectChanges();

        expect(component.registrationContact).toBe("");
        expect(component.error).toBe("");
        expect(component.fieldErrors).toEqual({});
        const input = element.querySelector<HTMLInputElement>("#reset-registration-contact");
        expect(input?.type).toBe("email");
        expect(input?.autocomplete).toBe("email");
    });

    it("rejects missing selections and blank contacts without submitting registration", async () => {
        await component.registerAuthMethod();
        expect(component.error).toBe("Select an authentication method before registering.");
        component.selectRegistrationMethod("email");
        component.registrationContact = "   ";
        await component.registerAuthMethod();

        expect(component.error).toBe("Enter the email address or phone number to register.");
        expect(registration.enrollAuthMethod).not.toHaveBeenCalled();
    });

    it("registers the trimmed contact and renders the shared activation controls", async () => {
        registration.enrollAuthMethod.and.resolveTo(new CustomAuthResultV2(activation));
        component.selectRegistrationMethod("phone");
        component.registrationContact = " +15555550100 ";

        await component.registerAuthMethod();
        fixture.detectChanges();

        expect(registration.enrollAuthMethod).toHaveBeenCalledWith(methods[1], "+15555550100");
        expect(component.state).toBe(activation);
        expect(component.selectedRegistrationMethod).toBeNull();
        expect(component.registrationContact).toBe("");
        expect(element.querySelector("#reset-registration-contact")).toBeNull();
        expect(element.querySelector("input")?.getAttribute("placeholder")).toBe("Enter activation code");
        expect(element.textContent).toContain("Activate method");
    });

    it("preserves the selected method and contact when registration fails", async () => {
        registration.enrollAuthMethod.and.rejectWith(new Error("Registration request failed"));
        component.selectRegistrationMethod("email");
        component.registrationContact = "user@example.com";

        await component.registerAuthMethod();

        expect(component.state).toBe(registration);
        expect(component.selectedRegistrationMethod).toBe(methods[0]);
        expect(component.registrationContact).toBe("user@example.com");
        expect(component.error).toContain("Registration request failed");
        expect(component.loading).toBeFalse();
    });

    it("uses the refreshed activation state after resend and completes password reset", async () => {
        component.state = activation;
        component.code = "old-code";
        activation.resendChallenge.and.resolveTo(new CustomAuthResultV2(refreshedActivation));
        refreshedActivation.submitChallenge.and.resolveTo(new CustomAuthResultV2(new CompletedStateV2()));
        const completed = spyOn(component.completed, "emit");

        await component.resendRegistrationChallenge();
        expect(component.state).toBe(refreshedActivation);
        expect(component.code).toBe("");
        expect(component.resendCountdown).toBe(30);

        component.code = "12345678";
        await component.submitRegistrationChallenge();

        expect(refreshedActivation.submitChallenge).toHaveBeenCalledWith("12345678");
        expect(component.isCompleted).toBeTrue();
        expect(component.code).toBe("");
        expect(component.resendCountdown).toBe(0);
        expect(completed).toHaveBeenCalledWith(undefined);
    });

    it("clears registration fields when restarting", () => {
        component.selectRegistrationMethod("phone");
        component.registrationContact = "+15555550100";
        component.code = "123456";

        component.restart();

        expect(component.state).toBeNull();
        expect(component.selectedRegistrationMethod).toBeNull();
        expect(component.registrationContact).toBe("");
        expect(component.code).toBe("");
    });
});
