"use client";

import type { ActiveFlow, AuthAction, AuthFlowProps, InitialCredentials } from "../types";
import { startV2ResetPassword, V2ResetPasswordFlow } from "./V2ResetPasswordFlow";
import { startV2SignIn, V2SignInFlow } from "./V2SignInFlow";
import { startV2SignUp, V2SignUpFlow } from "./V2SignUpFlow";
import { getV2ErrorMessage } from "./utils/getV2ErrorMessage";

type V2AuthEntryFlowProps = Extract<AuthFlowProps, { version: "v2" }>;
type V2ActiveFlow = Extract<ActiveFlow, { version: "v2" }>;

function validateInitialResult(flow: V2ActiveFlow): V2ActiveFlow {
    if (flow.initialResult.isFailed()) {
        throw new Error(getV2ErrorMessage(flow.initialResult.error));
    }

    return flow;
}

export async function startV2AuthFlow(
    app: AuthFlowProps["app"],
    action: AuthAction,
    credentials: InitialCredentials,
): Promise<V2ActiveFlow> {
    let flow: V2ActiveFlow;

    switch (action) {
        case "signIn":
            flow = {
                version: "v2",
                action,
                username: credentials.username,
                initialResult: await startV2SignIn(app, credentials),
            };
            break;
        case "signUp":
            flow = {
                version: "v2",
                action,
                username: credentials.username,
                initialResult: await startV2SignUp(app, credentials),
            };
            break;
        case "resetPassword":
            flow = {
                version: "v2",
                action,
                username: credentials.username,
                initialResult: await startV2ResetPassword(app, credentials.username),
            };
            break;
    }

    return validateInitialResult(flow);
}

export function V2AuthEntryFlow(props: V2AuthEntryFlowProps) {
    switch (props.action) {
        case "signIn":
            return <V2SignInFlow {...props} />;
        case "signUp":
            return <V2SignUpFlow {...props} />;
        case "resetPassword":
            return <V2ResetPasswordFlow {...props} />;
    }
}

export default V2AuthEntryFlow;
