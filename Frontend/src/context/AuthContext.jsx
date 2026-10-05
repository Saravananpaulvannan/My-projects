import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentAdmin,
  getCurrentCustomer,
  loginAdmin,
  loginCustomer as loginCustomerRequest,
  logoutAdmin,
  logoutCustomer as logoutCustomerRequest,
  registerCustomer as registerCustomerRequest,
} from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCurrentAdmin().catch(() => null),
      getCurrentCustomer().catch(() => null),
    ]).then(([adminSession, customerSession]) => {
      if (!active) return;
      setAdmin(adminSession);
      setCustomer(customerSession);
    }).finally(() => active && setLoading(false));
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

    const loginCustomer = async (credentials) => {
      try {
        const session = await loginCustomerRequest(credentials);
        setCustomer(session.user);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    };

    const registerCustomer = async (profile) => {
      try {
        const session = await registerCustomerRequest(profile);
        setCustomer(session.user);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    };

    const logoutCustomer = async () => {
      try {
        await logoutCustomerRequest();
      } catch {
        // Local access is cleared even if the server cannot be reached.
      } finally {
        setCustomer(null);
      }
    };

    return {
      admin,
      isAdmin: !!admin,
      customer,
      isCustomer: !!customer,
      loading,
      login,
      logout,
      loginCustomer,
      registerCustomer,
      logoutCustomer,
      loginOpen,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
    };
  }, [admin, customer, loading, loginOpen]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
