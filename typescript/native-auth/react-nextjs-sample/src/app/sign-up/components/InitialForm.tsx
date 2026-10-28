import Image from "next/image";
import { styles } from "../styles/styles";
import type { SignUpInitialFormProps } from "../types/formProperties";

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

export function InitialForm({
    onSubmit,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    jobTitle,
    setJobTitle,
    city,
    setCity,
    country,
    setCountry,
    email,
    setEmail,
    flatUsername,
    setFlatUsername,
    loading,
    onSignUpWithSocial,
}: SignUpInitialFormProps) {
    return (
        <form onSubmit={onSubmit} style={styles.form}>
            <input
                type="text"
                placeholder="Username (alias)"
                value={flatUsername}
                onChange={(e) => setFlatUsername(e.target.value)}
                style={styles.input}
            />
            <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={styles.input}
                required
            />
            <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={styles.input}
                required
            />
            <input
                type="text"
                placeholder="Job Title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                style={styles.input}
                required
            />
            <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={styles.input}
                required
            />
            <input
                type="text"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={styles.input}
                required
            />
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
            />
            <button type="submit" style={styles.button} disabled={loading}>
                {loading ? "Signing up..." : "Sign Up"}
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
                    onClick={() => onSignUpWithSocial(provider.domainHint)}
                >
                    <span style={styles.providerLogo}>
                        <Image src={provider.logo} alt={`${provider.name} logo`} width={20} height={20} />
                    </span>
                    <span>Sign Up with {provider.name}</span>
                </button>
            ))}
        </form>
    );
}
