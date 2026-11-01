import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, setAuthToken, clearAuthToken, getAuthToken } from '../services/apiClient';
import { sseClient } from '../services/sseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore authenticated session on mount
  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      const savedToken = getAuthToken();
      if (!savedToken) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await apiClient.getMe();
        if (mounted) {
          if (res && res.success && res.staff) {
            setUser(res.staff);
            sseClient.connect(savedToken);
          } else {
            clearAuthToken();
            setUser(null);
            setTokenState(null);
            sseClient.disconnect();
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Session restore failed:', err.message);
        if (mounted) {
          clearAuthToken();
          setUser(null);
          setTokenState(null);
          sseClient.disconnect();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    restoreSession();

    // Listen for session expiration
    const handleAuthExpired = () => {
      console.warn('[AuthContext] Token expired or invalid. Logging out...');
      clearAuthToken();
      setUser(null);
      setTokenState(null);
      sseClient.disconnect();
    };

    window.addEventListener('auth:expired', handleAuthExpired);

    return () => {
      mounted = false;
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, []);

  // Login handler
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const res = await apiClient.login({ email, password });
      if (res && res.success) {
        setUser(res.staff);
        setTokenState(res.token);
        setAuthToken(res.token);
        sseClient.connect(res.token);
        return res;
      } else {
        const errMsg = res?.message || 'Login failed. Please check your credentials.';
        setError(errMsg);
        return { success: false, message: errMsg };
      }
    } catch (err) {
      console.error('[AuthContext] Login error:', err);
      const errMsg = err.message || 'Network error during login.';
      setError(errMsg);
      return { success: false, message: errMsg };
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (err) {
      console.warn('[AuthContext] Logout warning:', err.message);
    } finally {
      clearAuthToken();
      setUser(null);
      setTokenState(null);
      sseClient.disconnect();
    }
  }, []);

  // Computed permission flags
  const isAuthenticated = Boolean(user && token);
  const isAdmin = user?.role === 'ADMIN';
  const isNurse = user?.role === 'NURSE';
  const canManageStaff = isAdmin;
  const canManageDevices = isAdmin;
  const canControlSimulator = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        logout,
        isAuthenticated,
        isAdmin,
        isNurse,
        canManageStaff,
        canManageDevices,
        canControlSimulator,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
