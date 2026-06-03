'use client';

import { createContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe } from '@/api/client';
import type { SessionUser } from '@electricalwizard/shared';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAdmin: false,
  isOwner: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const isOwner = user?.role === 'owner';
  const isAdmin = isOwner || user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isOwner }}>
      {children}
    </AuthContext.Provider>
  );
}
