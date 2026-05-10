import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    });

    async function init() {
      // OAuth callback: tokens arrive in URL hash from Lovable OAuth broker.
      // Parse them BEFORE getSession() so the session is established before
      // AuthenticatedLayout's useEffect checks auth state.
      if (typeof window !== "undefined") {
        const hash = window.location.hash;
        console.log("[AuthProvider] hash:", hash ? hash.substring(0, 50) : "none");
        if (hash && hash.includes("access_token=")) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          console.log("[AuthProvider] found access_token:", !!access_token);
          if (access_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token || "",
            });
            console.log("[AuthProvider] setSession error:", error);
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      console.log("[AuthProvider] getSession result:", data.session ? "has session" : "no session");
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    }

    init();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
