import { createContext, useContext, useState, useCallback } from "react";
import type { SafeUser } from "@shared/schema";
import { apiRequest } from "./queryClient";
import { queryClient } from "./queryClient";

interface AuthState {
  user: SafeUser | null;
  token: string | null;
  loading: boolean;
  requestMagicLink: (email: string) => Promise<{ sent: boolean }>;
  verifyCode: (email: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: false,
  requestMagicLink: async () => ({ sent: false }),
  verifyCode: async () => {},
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

  const requestMagicLink = useCallback(async (email: string) => {
    const res = await apiRequest("POST", "/api/auth/magic-link", { email });
    return await res.json();
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const res = await apiRequest("POST", "/api/auth/verify-code", { email, code });
    const data = await res.json();
    storedToken = data.token;
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    if (storedToken) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${storedToken}` },
      }).catch(() => {});
    }
    storedToken = null;
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, requestMagicLink, verifyCode, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
