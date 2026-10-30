"use client";

import type { ActiveFlow, AuthAction, AuthFlowProps, InitialCredentials } from "../types";
import { startV1ResetPassword, V1ResetPasswordFlow } from "./V1ResetPasswordFlow";
import { startV1SignIn, V1SignInFlow } from "./V1SignInFlow";
import { startV1SignUp, V1SignUpFlow } from "./V1SignUpFlow";

type V1AuthEntryFlowProps = Extract<AuthFlowProps, { version: "v1" }>;
type V1ActiveFlow = Extract<ActiveFlow, { version: "v1" }>;

function validateInitialResult(flow: V1ActiveFlow): V1ActiveFlow {
    if (!flow.initialResult.isFailed()) {
        return flow;
    }

    if (flow.action === "signIn" && flow.initialResult.error?.isRedirectRequired()) {
        return flow;
    }

    throw new Error(
        flow.initialResult.error?.errorData.errorDescription ||
            "The authentication request could not be started.",
    );
}

export async function startV1AuthFlow(
    app: AuthFlowProps["app"],
    action: AuthAction,
    credentials: InitialCredentials,
): Promise<V1ActiveFlow> {
    let flow: V1ActiveFlow;

    switch (action) {
        case "signIn":
            flow = {
                version: "v1",
                action,
                username: credentials.username,
                initialResult: await startV1SignIn(app, credentials),
            };
            break;
        case "signUp":
            flow = {
                version: "v1",
                action,
                username: credentials.username,
                initialResult: await startV1SignUp(app, credentials),
            };
            break;
        case "resetPassword":
            flow = {
                version: "v1",
                action,
                username: credentials.username,
                initialResult: await startV1ResetPassword(app, credentials.username),
            };
            break;
    }

    return validateInitialResult(flow);
}

export function V1AuthEntryFlow(props: V1AuthEntryFlowProps) {
    switch (props.action) {
        case "signIn":
            return <V1SignInFlow {...props} />;
        case "signUp":
            return <V1SignUpFlow {...props} />;
        case "resetPassword":
            return <V1ResetPasswordFlow {...props} />;
    }
}

export default V1AuthEntryFlow;
