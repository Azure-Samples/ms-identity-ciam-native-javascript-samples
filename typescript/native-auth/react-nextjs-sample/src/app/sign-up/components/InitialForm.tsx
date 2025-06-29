import { styles } from "../styles/styles";

interface InitialFormProps {
    onSubmit: (e: React.FormEvent) => Promise<void>;
    firstName: string;
    setFirstName: (value: string) => void;
    lastName: string;
    setLastName: (value: string) => void;
    jobTitle: string;
    setJobTitle: (value: string) => void;
    city: string;
    setCity: (value: string) => void;
    country: string;
    setCountry: (value: string) => void;
    email: string;
    setEmail: (value: string) => void;
    loading: boolean;
}

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
    loading,
}: InitialFormProps) {
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
        </form>
    );
}
