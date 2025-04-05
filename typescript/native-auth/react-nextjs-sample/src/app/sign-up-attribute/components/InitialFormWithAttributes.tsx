import { styles } from "../styles/styles";

interface InitialFormWithAttributesProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    firstName: string;
    setFirstName: (value: string) => void;
    lastName: string;
    setLastName: (value: string) => void;
    email: string;
    setEmail: (value: string) => void;
    jobTitle: string;
    setJobTitle: (value: string) => void;
    streetAddress: string;
    setStreetAddress: (value: string) => void;
    city: string;
    setCity: (value: string) => void;
    postalCode: string;
    setPostalCode: (value: string) => void;
    country: string;
    setCountry: (value: string) => void;
    loading: boolean;
}

export function InitialFormWithAttributes({
    onSubmit,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    jobTitle,
    setJobTitle,
    streetAddress,
    setStreetAddress,
    city,
    setCity,
    postalCode,
    setPostalCode,
    country,
    setCountry,
    loading
}: InitialFormWithAttributesProps) {
    return (
        <form onSubmit={onSubmit} style={styles.form}>
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
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="Street Address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
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
                placeholder="Postal Code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
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
            <button type="submit" style={styles.button} disabled={loading}>
                {loading ? "Signing up..." : "Sign Up"}
            </button>
        </form>
    );
}