import type {
    CustomAuthAccountData,
    ICustomAuthPublicClientApplicationV2,
    ResetPasswordStartResult,
    ResetPasswordStartResultV2,
    SignInResult,
    SignInStartResultV2,
    SignUpResult,
    SignUpStartResultV2,
} from "@azure/msal-browser/custom-auth";

export type AuthVersion = "v1" | "v2";

export type AuthAction = "signIn" | "signUp" | "resetPassword";

/** Describes the initial local-account action and the form values submitted for it. Password is omitted when it is blank or the action is password reset. */
export interface AuthStartRequest {
    action: AuthAction;
    username: string;
    password?: string;
}

export interface InitialCredentials {
    username: string;
    password?: string;
}

interface ActiveFlowBase {
    username: string;
}

export type ActiveFlow =
    | (ActiveFlowBase & {
          version: "v1";
          action: "signIn";
          initialResult: SignInResult;
      })
    | (ActiveFlowBase & {
          version: "v1";
          action: "signUp";
          initialResult: SignUpResult;
      })
    | (ActiveFlowBase & {
          version: "v1";
          action: "resetPassword";
          initialResult: ResetPasswordStartResult;
      })
    | (ActiveFlowBase & {
          version: "v2";
          action: "signIn";
          initialResult: SignInStartResultV2;
      })
    | (ActiveFlowBase & {
          version: "v2";
          action: "signUp";
          initialResult: SignUpStartResultV2;
      })
    | (ActiveFlowBase & {
          version: "v2";
          action: "resetPassword";
          initialResult: ResetPasswordStartResultV2;
      });

interface AuthFlowCallbacks {
    app: ICustomAuthPublicClientApplicationV2;
    onCancel: () => void;
    onCompleted: (account?: CustomAuthAccountData) => void;
}

export type AuthFlowProps = ActiveFlow & AuthFlowCallbacks;
