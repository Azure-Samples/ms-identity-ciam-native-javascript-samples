"use client";

import Link from "next/link";
import { useAuth } from "../app/auth/AuthProvider";
import styles from "./Navbar.module.css";

export default function Navbar() {
    const { loading, signOut } = useAuth();

    return (
        <nav className={styles.navbar}>
            <div className={styles.logo}>
                <Link href="/">MSAL Auth</Link>
            </div>
            <div className={styles.links}>
                <button
                    onClick={() => void signOut()}
                    className={styles.link}
                    disabled={loading}
                >
                    Sign Out
                </button>
            </div>
        </nav>
    );
}
