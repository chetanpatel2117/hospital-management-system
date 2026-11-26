import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const currentUser = await api('/api/auth/me');
      setUser(currentUser);
      setAuthError('');
      return currentUser;
    } catch (error) {
      if (/401|sign in|role is not mapped/i.test(error.message)) {
        setUser(null);
        setAuthError('');
        return null;
      }
      setUser(null);
      setAuthError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch((error) => {
      console.error('Unable to verify the current session:', error);
    });
  }, [refresh]);

  const signIn = useCallback(async (credentials) => {
    const signedInUser = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    setUser(signedInUser);
    setAuthError('');
    return signedInUser;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, authError, signIn, signOut, refresh }), [user, loading, authError, signIn, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
