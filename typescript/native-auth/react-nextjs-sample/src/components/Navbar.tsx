"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomAuthPublicClientApplication } from "@azure/msal-browser/custom-auth";
import { customAuthConfig } from "../config/auth-config";
import styles from "./Navbar.module.css";

export default function Navbar() {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            const app = await CustomAuthPublicClientApplication.create(customAuthConfig);
            const account = app.getCurrentAccount();
            if (account.data) {
                await account.data.signOut();
                console.log("User signed out successfully.");
            } else {
                console.log("No user currently signed in.");
            }
            // Clear any local session/state if necessary (MSAL handles its own cache)
            router.push("/"); // Redirect to home page after logout
        } catch (error) {
            console.error("Logout failed:", error);
            // Optionally, show an error message to the user
        }
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.logo}>
                <Link href="/">MSAL Auth</Link>
            </div>
            <div className={styles.links}>
                <Link href="/sign-in" className={styles.link}>
                    Sign In OTP/password
                </Link>
                <Link href="/sign-up" className={styles.link}>
                    Sign Up with OTP
                </Link>
                <Link href="/sign-up-password" className={styles.link}>
                    Sign Up with Password
                </Link>
                <Link href="/sign-up-attribute" className={styles.link}>
                    Sign Up with Attributes
                </Link>
                <Link href="/reset-password" className={styles.link}>
                    Reset Password
                </Link>
                <button onClick={handleLogout} className={styles.link} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', textDecoration: 'underline' }}>
                    Logout
                </button>
            </div>
        </nav>
    );
}
