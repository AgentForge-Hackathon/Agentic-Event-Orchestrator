import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "@/lib/apiClient";
import { getToken, setTokens, clearTokens } from "@/lib/tokenStorage";

// ---------------------
// Types
// ---------------------

type AuthUser = {
  id: string;
  email: string;
  name: string;
  isOnboarded: boolean;
};

/** Minimal session shape returned by backend login / signup */
type SessionData = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

type AuthContextType = {
  user: AuthUser | null;
  session: SessionData | null;
  loading: boolean;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  markOnboarded: () => void;
};

// ---------------------
// Backend response types
// ---------------------

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string; name: string };
};

type SignupResponse = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  user: { id: string; email: string; name: string };
};

type ProfileResponse = {
  profile: { name: string; is_onboarded: boolean } | null;
};

// ---------------------
// Context
// ---------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------
// Provider
// ---------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Build an AuthUser by merging basic user info with the profile record
  function buildUser(
    base: { id: string; email: string; name: string },
    profile?: { name?: string; is_onboarded?: boolean } | null
  ): AuthUser {
    return {
      id: base.id,
      email: base.email,
      name: profile?.name ?? base.name ?? base.email.split("@")[0],
      isOnboarded: profile?.is_onboarded ?? false,
    };
  }

  // Fetch profile from backend and merge with base user data
  async function fetchAndSetUser(
    base: { id: string; email: string; name: string },
    sessionData: SessionData
  ): Promise<void> {
    setSession(sessionData);
    try {
      const { data } = await apiClient.get<ProfileResponse>("/auth/profile");
      setUser(buildUser(base, data?.profile));
    } catch {
      setUser(buildUser(base, null));
    }
  }

  // On mount: rehydrate session from localStorage
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Verify the stored token is still valid by hitting the profile endpoint.
    // The apiClient already injects the token from tokenStorage.
    apiClient
      .get<ProfileResponse & { user?: { id: string; email: string; name: string } }>(
        "/auth/profile"
      )
      .then(({ data, status }) => {
        if (status === 401 || !data) {
          // Token expired or invalid — clear it
          clearTokens();
          setLoading(false);
          return;
        }
        // Profile endpoint only returns `profile`, not the base user.
        // We can reconstruct minimal user from profile data alone.
        if (data.profile) {
          setSession({ access_token: token, refresh_token: "" });
          setUser({
            id: "", // not returned by /profile — filled below if needed
            email: "",
            name: data.profile.name ?? "",
            isOnboarded: data.profile.is_onboarded ?? false,
          });
        }
        setLoading(false);
      })
      .catch(() => {
        clearTokens();
        setLoading(false);
      });
  }, []);

  // Sign in via backend
  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    const { data, error } = await apiClient.post<LoginResponse>(
      "/auth/login",
      { email, password }
    );

    if (error || !data) {
      return { error: error ?? "Login failed" };
    }

    const sessionData: SessionData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };

    setTokens(data.access_token, data.refresh_token, data.expires_at);
    await fetchAndSetUser(data.user, sessionData);
    return {};
  };

  // Sign up via backend
  const signUpWithEmail = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ error?: string }> => {
    const { data, error } = await apiClient.post<SignupResponse>(
      "/auth/signup",
      { email, password, name }
    );

    if (error || !data) {
      return { error: error ?? "Signup failed" };
    }

    // If Supabase email confirmation is disabled, we get a session immediately
    if (data.access_token) {
      const sessionData: SessionData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? "",
        expires_at: data.expires_at ?? undefined,
      };
      setTokens(data.access_token, data.refresh_token, data.expires_at);
      await fetchAndSetUser(data.user, sessionData);
    }
    // If email confirmation is required, session is null — caller shows
    // "check your email" UI (same behaviour as before)

    return {};
  };

  // Sign out via backend, then clear local state
  const signOut = async (): Promise<void> => {
    // Best-effort server-side session revocation
    await apiClient.post("/auth/logout", {});
    clearTokens();
    setUser(null);
    setSession(null);
  };

  const markOnboarded = (): void => {
    if (user) {
      setUser({ ...user, isOnboarded: true });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        markOnboarded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
