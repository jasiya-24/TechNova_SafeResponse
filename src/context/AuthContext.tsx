import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AdminUser } from '../types/incident';

interface AuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: AdminUser }>;
  registerCitizen: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    city?: string;
  }) => Promise<{ ok: boolean; error?: string; user?: AdminUser }>;
  registerVolunteer: (input: {
    name: string;
    email: string;
    password: string;
    qualification: string;
    skills?: string;
    location?: string;
  }) => Promise<{ ok: boolean; error?: string; user?: AdminUser }>;
  updateCitizenProfile: (updates: {
    name?: string;
    phone?: string;
    city?: string;
  }) => Promise<{ ok: boolean; error?: string; user?: AdminUser }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { user: AdminUser | null };
        setAdmin(data.user ?? null);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { user?: AdminUser; error?: string };
      if (!res.ok || !data.user) {
        return { ok: false, error: data.error || 'Login failed.' };
      }
      setAdmin(data.user);
      return { ok: true, user: data.user };
    } catch {
      return { ok: false, error: 'Unable to reach the authentication server.' };
    }
  };

  const registerCitizen = async (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    city?: string;
  }) => {
    try {
      const res = await fetch('/api/auth/citizen/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { user?: AdminUser; error?: string };
      if (!res.ok || !data.user) {
        return { ok: false, error: data.error || 'Registration failed.' };
      }
      setAdmin(data.user);
      return { ok: true, user: data.user };
    } catch {
      return { ok: false, error: 'Unable to reach the authentication server.' };
    }
  };

  const registerVolunteer = async (input: {
    name: string;
    email: string;
    password: string;
    qualification: string;
    skills?: string;
    location?: string;
  }) => {
    try {
      const res = await fetch('/api/auth/volunteer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { user?: AdminUser; error?: string };
      if (!res.ok || !data.user) {
        return { ok: false, error: data.error || 'Volunteer registration failed.' };
      }
      setAdmin(data.user);
      return { ok: true, user: data.user };
    } catch {
      return { ok: false, error: 'Unable to reach the authentication server.' };
    }
  };

  const updateCitizenProfile = async (updates: {
    name?: string;
    phone?: string;
    city?: string;
  }) => {
    try {
      const res = await fetch('/api/citizen/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      const data = (await res.json()) as { user?: AdminUser; error?: string };
      if (!res.ok || !data.user) {
        return { ok: false, error: data.error || 'Profile update failed.' };
      }
      setAdmin(data.user);
      return { ok: true, user: data.user };
    } catch {
      return { ok: false, error: 'Unable to reach the server.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        loading,
        login,
        registerCitizen,
        registerVolunteer,
        updateCitizenProfile,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
