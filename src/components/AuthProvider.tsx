import { createContext, useContext } from "react";
import { Session, User } from "@supabase/supabase-js";

// ─── DEMO MODE ─────────────────────────────────────────────────────
// Authentication is bypassed. A fake demo user is injected everywhere.
// To re-enable auth, restore the original AuthProvider from git history.

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_EMAIL = "test123@gmail.com";

const demoUser: User = {
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    app_metadata: {},
    user_metadata: { full_name: "Demo User" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
} as User;

const demoSession: Session = {
    access_token: "demo-access-token",
    refresh_token: "demo-refresh-token",
    expires_in: 999999,
    token_type: "bearer",
    user: demoUser,
} as Session;

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: demoSession,
    user: demoUser,
    isLoading: false,
    signOut: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    // Demo mode: always provide a fake user, never loading
    return (
        <AuthContext.Provider value={{
            session: demoSession,
            user: demoUser,
            isLoading: false,
            signOut: async () => { console.log("Demo mode: sign out is disabled."); },
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

// Route guards are now pass-through — no redirects
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

export const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};
