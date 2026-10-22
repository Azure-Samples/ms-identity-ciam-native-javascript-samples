import Image from "next/image";

const socialProviders = [
    { name: "Google", domainHint: "Google", logo: "/logos/google.svg" },
    { name: "Facebook", domainHint: "Facebook", logo: "/logos/facebook.svg" },
    { name: "Apple", domainHint: "Apple", logo: "/logos/apple.svg" },
    { name: "LinkedIn", domainHint: "www.linkedin.com", logo: "/logos/linkedin.svg" },
] as const;

interface SocialProviderButtonsProps {
    onSelect: (domainHint: string) => Promise<void>;
    loading: boolean;
}

export function SocialProviderButtons({ onSelect, loading }: SocialProviderButtonsProps) {
    return (
        <>
            <div className="auth-separator">
                <div className="auth-separator-line"></div>
                <span className="auth-separator-text">OR</span>
                <div className="auth-separator-line"></div>
            </div>
            {socialProviders.map((provider) => (
                <button
                    key={provider.domainHint}
                    type="button"
                    className="auth-social-button"
                    onClick={() => void onSelect(provider.domainHint)}
                    disabled={loading}
                >
                    <span className="auth-provider-logo">
                        <Image src={provider.logo} alt={`${provider.name} logo`} width={20} height={20} />
                    </span>
                    <span>Continue with {provider.name}</span>
                </button>
            ))}
        </>
    );
}
