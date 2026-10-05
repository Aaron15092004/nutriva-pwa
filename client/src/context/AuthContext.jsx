import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../lib/api.js';
import { clearApiCache } from '../lib/useApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    clearApiCache();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    window.addEventListener('nutriva:logout', logout);
    return () => window.removeEventListener('nutriva:logout', logout);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      ready,
      setUser,
      async login(email, password) {
        const d = await api.post('/auth/login', { email, password });
        clearApiCache();
        tokenStore.set(d.token);
        setUser(d.user);
      },
      async register(payload) {
        const d = await api.post('/auth/register', payload);
        clearApiCache();
        tokenStore.set(d.token);
        setUser(d.user);
      },
      async update(patch) {
        const d = await api.patch('/auth/me', patch);
        setUser(d.user);
        return d.user;
      },
      logout,
    }),
    [user, ready, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
