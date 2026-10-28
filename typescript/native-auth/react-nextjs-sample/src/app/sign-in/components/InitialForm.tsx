import Image from "next/image";
import { styles } from "../styles/styles";
import type { SignInInitialFormProps } from "../types/formProperties";

const socialProviders = [
    {
        name: "Google",
        domainHint: "Google",
        logo: "/logos/google.svg",
    },
    {
        name: "Facebook",
        domainHint: "Facebook",
        logo: "/logos/facebook.svg",
    },
    {
        name: "Apple",
        domainHint: "Apple",
        logo: "/logos/apple.svg",
    },
    {
        name: "LinkedIn",
        domainHint: "www.linkedin.com",
        logo: "/logos/linkedin.svg",
    },
];

export const InitialForm = ({
    onSubmit,
    username,
    setUsername,
    loading,
    onSignInWithSocial,
}: SignInInitialFormProps) => (
    <form onSubmit={onSubmit} style={styles.form}>
        <input
            type="text"
            placeholder="Email or Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            required
        />
        <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
        </button>
        <div style={styles.separator}>
            <div style={styles.separatorLine}></div>
            <span style={styles.separatorText}>OR</span>
            <div style={styles.separatorLine}></div>
        </div>
        {socialProviders.map((provider) => (
            <button
                key={provider.domainHint}
                type="button"
                style={styles.socialButton}
                onClick={() => onSignInWithSocial(provider.domainHint)}
            >
                <span style={styles.providerLogo}>
                    <Image src={provider.logo} alt={`${provider.name} logo`} width={20} height={20} />
                </span>
                <span>Sign In with {provider.name}</span>
            </button>
        ))}
    </form>
);
