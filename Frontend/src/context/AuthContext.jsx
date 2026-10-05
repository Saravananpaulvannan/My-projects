import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentAdmin, loginAdmin, logoutAdmin } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentAdmin()
      .then((session) => active && setAdmin(session))
      .catch(() => active && setAdmin(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const value = useMemo(() => {
    const login = async (phone, password) => {
      try {
        const session = await loginAdmin({ phone, password });
        setAdmin(session.admin);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    };

    const logout = async () => {
      try {
        await logoutAdmin();
      } catch {
        // Local access is cleared even if the server cannot be reached.
      } finally {
        setAdmin(null);
      }
    };

    return {
      admin,
      isAdmin: !!admin,
      loading,
      login,
      logout,
      loginOpen,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
    };
  }, [admin, loading, loginOpen]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
