import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await authService.me();
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // The API layer emits this when a session expires or an account is disabled mid-session.
    const onUnauthorized = (e) => {
      setUser((current) => {
        if (current) setSessionMessage(e.detail?.message || 'Your session has ended. Please sign in again.');
        return null;
      });
    };
    window.addEventListener('sm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sm:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const { data } = await authService.login(credentials);
    setUser(data);
    setSessionMessage(null);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      login,
      logout,
      refresh,
      setUser,
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(null),
    }),
    [user, loading, login, logout, refresh, sessionMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
