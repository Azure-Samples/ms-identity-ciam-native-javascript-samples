"use client";

import {
    createContext,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    CustomAuthPublicClientApplication,
    type CustomAuthAccountData,
    type ICustomAuthPublicClientApplicationV2,
} from "@azure/msal-browser/custom-auth";
import { customAuthConfig } from "../../config/auth-config";

interface AuthContextValue {
    app?: ICustomAuthPublicClientApplicationV2;
    account?: CustomAuthAccountData;
    error: string;
    loading: boolean;
    setAccount: Dispatch<SetStateAction<CustomAuthAccountData | undefined>>;
    setError: Dispatch<SetStateAction<string>>;
    setLoading: Dispatch<SetStateAction<boolean>>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getThrownErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected authentication error occurred.";
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [app, setApp] = useState<ICustomAuthPublicClientApplicationV2>();
    const [account, setAccount] = useState<CustomAuthAccountData>();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const initialize = async () => {
            try {
                const appInstance = await CustomAuthPublicClientApplication.create(customAuthConfig);
                if (!active) {
                    return;
                }

                setApp(appInstance);
                const accountResult = appInstance.getCurrentAccount();
                if (accountResult.isFailed()) {
                    setError(
                        accountResult.error?.errorData.errorDescription ||
                            "An error occurred while reading the current account.",
                    );
                }
                if (accountResult.isCompleted()) {
                    setAccount(accountResult.data);
                }
            } catch (caughtError) {
                if (active) {
                    setError(getThrownErrorMessage(caughtError));
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void initialize();
        return () => {
            active = false;
        };
    }, []);

    const signOut = useCallback(async () => {
        if (!account) {
            return;
        }

        setError("");
        setLoading(true);
        try {
            await account.signOut();
            setAccount(undefined);
        } catch (caughtError) {
            setError(getThrownErrorMessage(caughtError));
        } finally {
            setLoading(false);
        }
    }, [account]);

    const value = useMemo(
        () => ({
            app,
            account,
            error,
            loading,
            setAccount,
            setError,
            setLoading,
            signOut,
        }),
        [account, app, error, loading, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider.");
    }

    return context;
}
