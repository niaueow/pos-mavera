import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser, loginUser, fetchCurrentUser } from '../services/authService';
import { ApiClientError } from '../services/apiClient';

// ─── Token storage strategy ───────────────────────────────────────────────
// We store the JWT in sessionStorage (not localStorage) so it is:
//   - NOT persisted across browser tabs/windows (principle of least exposure).
//   - Cleared automatically when the browser tab is closed.
//   - Not accessible by scripts on other origins (same-origin policy).
// Trade-off: XSS attacks can still read sessionStorage. In a Phase 2
// production build, consider HttpOnly cookies delivered by the backend.
// Per AGENTS.md Rule 8: we never trust client-supplied auth/role on the
// backend, so the frontend token is only a convenience — the backend
// always re-validates the JWT on every protected request.
const TOKEN_KEY = 'pos_mavera_staff_token';

function saveToken(token: string) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}

function loadToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on mount
  useEffect(() => {
    const storedToken = loadToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    fetchCurrentUser(storedToken)
      .then((res) => {
        setToken(storedToken);
        setUser(res.data);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await loginUser(email, password);
    saveToken(res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, isAuthenticated: !!user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { ApiClientError };
