import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { SafeUser } from "@shared/schema";
import { apiRequest } from "./queryClient";
import { queryClient } from "./queryClient";

interface AuthConfig {
  googleClientId: string | null;
  ssoEnabled: boolean;
  allowEmailAuth: boolean;
  allowPasswordAuth: boolean;
  orgName: string;
  demoMode: boolean;
}

interface AuthState {
  user: SafeUser | null;
  token: string | null;
  loading: boolean;
  restoring: boolean;
  authConfig: AuthConfig | null;
  requestMagicLink: (email: string) => Promise<{ sent: boolean; demoCode?: string }>;
  verifyCode: (email: string, code: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: false,
  restoring: true,
  authConfig: null,
  requestMagicLink: async () => ({ sent: false }),
  verifyCode: async () => {},
  loginWithGoogle: async () => {},
  loginWithPassword: async () => {},
  logout: () => {},
});

let storedToken: string | null = null;

export function getAuthToken(): string | null {
  return storedToken;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  // Restore session from httpOnly cookie on mount
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          storedToken = "cookie";
          setToken("cookie");
          setUser(data);
        }
      })
      .catch(() => {})
      .finally(() => setRestoring(false));

    // Fetch auth config
    fetch("/api/auth/config")
      .then((res) => res.json())
      .then((config) => setAuthConfig(config))
      .catch(() => {});
  }, []);

  function handleAuthResponse(data: { token: string; user: SafeUser }) {
    storedToken = data.token;
    setToken(data.token);
    setUser(data.user);
  }

  const requestMagicLink = useCallback(async (email: string) => {
    const res = await apiRequest("POST", "/api/auth/magic-link", { email });
    return await res.json();
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const res = await apiRequest("POST", "/api/auth/verify-code", { email, code });
    const data = await res.json();
    handleAuthResponse(data);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await apiRequest("POST", "/api/auth/google", { credential });
    const data = await res.json();
    handleAuthResponse(data);
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/password", { email, password });
    const data = await res.json();
    handleAuthResponse(data);
  }, []);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: storedToken && storedToken !== "cookie" ? { Authorization: `Bearer ${storedToken}` } : {},
    }).catch(() => {});
    storedToken = null;
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, token, loading, restoring, authConfig,
        requestMagicLink, verifyCode, loginWithGoogle, loginWithPassword, logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
