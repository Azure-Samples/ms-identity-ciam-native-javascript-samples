import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
    AttributesRequiredStateV2,
    AuthFlowStateBase,
    AuthMethodRegistrationRequiredStateV2,
    AuthMethodSelectionRequiredStateV2,
    AuthMethodVerificationRequiredStateV2,
    CodeRequiredStateV2,
    CompletedStateV2,
    type CustomAuthAccountData,
    CustomAuthFlowScenarioV2,
    CustomAuthPublicClientApplication,
    CustomAuthResultV2,
    ExistingAccountCodeRequiredStateV2,
    ExistingAccountPasswordRequiredStateV2,
    MFAVerificationRequiredStateV2,
    PasswordRequiredStateV2,
    SignInContinuationStateV2,
} from "@azure/msal-browser/custom-auth";
import { AuthService } from "../../services/auth.service";
import { SignUpV2Component } from "./sign-up-v2.component";

function stateSpy<T extends AuthFlowStateBase>(
    stateClass: { prototype: T },
    methods: jasmine.SpyObjMethodNames<T>,
    properties: jasmine.SpyObjPropertyNames<T>,
): jasmine.SpyObj<T> {
    const state = jasmine.createSpyObj<T>("state", methods, properties);
    Object.setPrototypeOf(state, stateClass.prototype);
    return state;
}

function result<T extends AuthFlowStateBase>(state: T) {
    return new CustomAuthResultV2(state, undefined, CustomAuthFlowScenarioV2.SignUp);
}

function completedResult() {
    return new CustomAuthResultV2<CompletedStateV2, CustomAuthAccountData>(
        new CompletedStateV2(),
        undefined,
        CustomAuthFlowScenarioV2.SignUp,
    );
}

describe("SignUpV2Component", () => {
    let fixture: ComponentFixture<SignUpV2Component>;
    let component: SignUpV2Component;
    let element: HTMLElement;
    let client: jasmine.SpyObj<CustomAuthPublicClientApplication>;

    beforeEach(async () => {
        jasmine.clock().install();
        spyOn(SignUpV2Component.prototype, "ngOnInit").and.resolveTo();
        client = jasmine.createSpyObj<CustomAuthPublicClientApplication>("client", ["signUpV2"]);
        const auth = jasmine.createSpyObj<AuthService>("auth", ["getClient"]);
        auth.getClient.and.resolveTo(client);
        await TestBed.configureTestingModule({
            imports: [SignUpV2Component],
            providers: [{ provide: AuthService, useValue: auth }],
        }).compileComponents();
        fixture = TestBed.createComponent(SignUpV2Component);
        component = fixture.componentInstance;
        element = fixture.nativeElement;
    });

    afterEach(() => {
        fixture.destroy();
        jasmine.clock().uninstall();
    });

    it("submits only the password, then follows successive profile steps and continuation", async () => {
        const password = stateSpy(PasswordRequiredStateV2, ["submitPassword"], {
            stateType: "passwordRequired",
            requestedPasswordAttribute: { attributeId: "password", label: "New password", required: true },
            attributes: [{ attributeId: "jobTitle", required: true }],
        });
        const firstProfile = stateSpy(AttributesRequiredStateV2, ["submitAttributes"], {
            stateType: "attributesRequired",
            attributes: [{ attributeId: "jobTitle", label: "Job title", required: true }],
        });
        const nextProfile = stateSpy(AttributesRequiredStateV2, ["submitAttributes"], {
            stateType: "attributesRequired",
            attributes: [{ attributeId: "city", label: "City", required: true }],
        });
        const continuation = stateSpy(SignInContinuationStateV2, ["signIn"], {
            stateType: "signInContinuation",
        });
        const code = stateSpy(CodeRequiredStateV2, ["submitCode"], { stateType: "codeRequired" });
        code.submitCode.and.resolveTo(result(password));
        password.submitPassword.and.resolveTo(result(firstProfile));
        firstProfile.submitAttributes.and.resolveTo(result(nextProfile));
        nextProfile.submitAttributes.and.resolveTo(result(continuation));
        continuation.signIn.and.resolveTo(completedResult());
        component.state = code;
        component.code = "123456";

        await component.submitCode();
        fixture.detectChanges();
        expect(element.querySelector("app-password-form")).not.toBeNull();
        expect(element.querySelector("app-dynamic-attributes-form")).toBeNull();
        expect(element.textContent).toContain("New password");

        component.password = "valid-password";
        await component.submitPassword();
        fixture.detectChanges();
        expect(password.submitPassword.calls.mostRecent().args).toEqual(["valid-password"]);
        expect(element.querySelector("app-password-form")).toBeNull();
        expect(element.querySelector("input[name='jobTitle']")).not.toBeNull();
        expect(component.password).toBe("");

        component.setAttributeValue("jobTitle", "Engineer");
        await component.submitAttributes();
        fixture.detectChanges();
        expect(firstProfile.submitAttributes).toHaveBeenCalledOnceWith({ jobTitle: "Engineer" });
        expect(component.attributeValues).toEqual({});
        expect(element.querySelector("input[name='jobTitle']")).toBeNull();
        expect(element.querySelector("input[name='city']")).not.toBeNull();

        component.setAttributeValue("city", "Seattle");
        await component.submitAttributes();
        expect(nextProfile.submitAttributes).toHaveBeenCalledOnceWith({ city: "Seattle" });
        expect(continuation.signIn).toHaveBeenCalledTimes(1);
        expect(component.isCompleted).toBeTrue();
    });

    it("accepts existing-account OTP, password, and method-selection states at signup start", async () => {
        const states = [
            stateSpy(ExistingAccountCodeRequiredStateV2, ["submitCode"], {
                stateType: "existingAccountCodeRequired",
            }),
            stateSpy(ExistingAccountPasswordRequiredStateV2, ["submitPassword"], {
                stateType: "existingAccountPasswordRequired",
            }),
            stateSpy(AuthMethodSelectionRequiredStateV2, ["selectAuthMethod"], {
                stateType: "authMethodSelectionRequired",
                methods: [],
            }),
        ];
        component.username = "user@example.com";
        for (const state of states) {
            client.signUpV2.and.resolveTo(result(state));
            await component.startSignUp();
            expect(component.state).toBe(state);
            expect(component.error).toBe("");
            expect("password" in client.signUpV2.calls.mostRecent().args[0]).toBeFalse();
        }
    });

    it("resends existing-account OTP and continues verification through method selection and MFA", async () => {
        const code = stateSpy(ExistingAccountCodeRequiredStateV2, ["resendCode"], {
            stateType: "existingAccountCodeRequired",
        });
        const refreshedCode = stateSpy(ExistingAccountCodeRequiredStateV2, ["submitCode"], {
            stateType: "existingAccountCodeRequired",
            sentTo: "u***@example.com",
            channel: "email",
            codeLength: 8,
        });
        const selection = stateSpy(AuthMethodSelectionRequiredStateV2, ["selectAuthMethod"], {
            stateType: "authMethodSelectionRequired",
            methods: [{ id: "phone", type: "sms", hint: "***1234", challengeHref: "/tenant/challenge" }],
        });
        const mfa = stateSpy(MFAVerificationRequiredStateV2, ["submitChallenge", "resendChallenge"], {
            stateType: "mfaVerificationRequired",
            channel: "sms",
        });
        code.resendCode.and.resolveTo(result(refreshedCode));
        refreshedCode.submitCode.and.resolveTo(result(selection));
        selection.selectAuthMethod.and.resolveTo(result(mfa));
        mfa.resendChallenge.and.resolveTo(result(mfa));
        mfa.submitChallenge.and.resolveTo(completedResult());
        component.state = code;
        component.code = "old-code";

        await component.resendCode();
        expect(component.codeState).toBe(refreshedCode);
        expect(component.code).toBe("");
        expect(component.codeState?.codeLength).toBe(8);
        component.code = "12345678";
        await component.submitCode();
        expect(component.methodSelectionState).toBe(selection);
        expect(component.resendCountdown).toBe(0);

        await component.selectAuthMethod("phone");
        expect(selection.selectAuthMethod).toHaveBeenCalledOnceWith(selection.methods[0]);
        fixture.detectChanges();
        expect(element.querySelector("app-code-form")).not.toBeNull();
        await component.resendVerificationCode();
        expect(component.mfaVerificationState).toBe(mfa);
        component.code = "87654321";
        await component.submitVerificationCode();
        expect(mfa.submitChallenge).toHaveBeenCalledOnceWith("87654321");
        expect(component.isCompleted).toBeTrue();
    });

    it("keeps an existing-password failure retryable, then advances to JIT rather than profile collection", async () => {
        const password = stateSpy(ExistingAccountPasswordRequiredStateV2, ["submitPassword"], {
            stateType: "existingAccountPasswordRequired",
        });
        const registration = stateSpy(AuthMethodRegistrationRequiredStateV2, ["selectAuthMethod"], {
            stateType: "authMethodRegistrationRequired",
            methods: [],
        });
        password.submitPassword.and.returnValues(
            Promise.resolve(CustomAuthResultV2.createWithError(new Error("Wrong password"), {
                scenario: CustomAuthFlowScenarioV2.SignUp,
            })),
            Promise.resolve(result(registration)),
        );
        component.state = password;
        fixture.detectChanges();
        expect(element.textContent).toContain("current password");
        expect(element.querySelector("input[autocomplete='current-password']")).not.toBeNull();
        expect(element.querySelector("app-dynamic-attributes-form")).toBeNull();

        component.password = "wrong-password";
        await component.submitPassword();
        expect(component.existingAccountPasswordState).toBe(password);
        expect(component.error).not.toBe("");

        component.password = "current-password";
        await component.submitPassword();
        expect(password.submitPassword.calls.mostRecent().args).toEqual(["current-password"]);
        expect(component.registrationState).toBe(registration);
        expect(component.error).toBe("");
        expect(component.password).toBe("");
    });

    it("preserves JIT activation resend and completion in the shared verification handlers", async () => {
        const activation = stateSpy(AuthMethodVerificationRequiredStateV2, ["submitChallenge", "resendChallenge"], {
            stateType: "authMethodVerificationRequired",
            type: "sms",
        });
        activation.resendChallenge.and.resolveTo(result(activation));
        activation.submitChallenge.and.resolveTo(completedResult());
        component.state = activation;
        fixture.detectChanges();
        expect(element.textContent).toContain("Activate method");

        await component.resendVerificationCode();
        expect(component.activationState).toBe(activation);
        component.code = "123456";
        await component.submitVerificationCode();
        expect(activation.submitChallenge).toHaveBeenCalledOnceWith("123456");
        expect(component.isCompleted).toBeTrue();
    });
});
