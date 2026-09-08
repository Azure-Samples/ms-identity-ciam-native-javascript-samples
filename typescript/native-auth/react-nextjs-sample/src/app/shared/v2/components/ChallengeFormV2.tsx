import { CodeForm } from "@/app/shared/components/CodeForm";
import type { CodeFormProps } from "@/app/shared/types/formProperties";

interface ChallengeFormPropsV2 extends CodeFormProps {
    sentTo?: string;
    channel?: string;
    codeLength?: number;
}

export function ChallengeFormV2({ sentTo, channel, codeLength, ...codeFormProps }: ChallengeFormPropsV2) {
    const destination = sentTo ? ` to ${sentTo}` : "";
    const deliveryChannel = channel ? ` by ${channel}` : "";
    const lengthHint = codeLength ? ` The code contains ${codeLength} characters.` : "";

    return (
        <>
            <p>
                A verification code was sent{destination}
                {deliveryChannel}.{lengthHint}
            </p>
            <CodeForm {...codeFormProps} />
        </>
    );
}
