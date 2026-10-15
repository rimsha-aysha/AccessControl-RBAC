import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

/**
 * Keeps track of the signed-in user and their permissions.
 * NOTE: these permissions are only used to show/hide UI. The backend checks
 * every request independently, so hiding a button is never the security boundary.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, role, isAdmin, permissions, accessibleBranchIds }
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    if (!tokenStore.get()) {
      setSession(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setSession(data);
    } catch {
      tokenStore.clear();
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setSession(null);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:expired', logout);
    return () => window.removeEventListener('auth:expired', logout);
  }, [logout]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      tokenStore.set(data.token);
      await loadSession();
    },
    [loadSession]
  );

  const value = useMemo(() => {
    const permissions = new Set(session?.permissions || []);
    return {
      session,
      user: session?.user,
      isAdmin: !!session?.isAdmin,
      loading,
      login,
      logout,
      refresh: loadSession,
      can: (key) => permissions.has(key),
    };
  }, [session, loading, login, logout, loadSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
