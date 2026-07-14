import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const ADMIN_TOKEN = 'wf-admin-2026';
const STORAGE_KEY = 'wf_admin_session';

interface AuthState {
  isAuthenticated: boolean;
  login: (token: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_KEY) === '1',
  );

  const login = useCallback((token: string) => {
    if (token.trim() === ADMIN_TOKEN) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthenticated(false);
  }, []);

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
