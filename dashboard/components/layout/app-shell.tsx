'use client';

import { useSSE } from '@/hooks/use-sse';
import { Sidebar } from './sidebar';
import { Header } from './header';

// The page renders while /auth/me is still loading, so its own queries start
// at the same time instead of a round trip later. The API enforces the role
// on every request (and a 401 sends the user to /login), so nothing depends
// on knowing the role first; role-dependent controls appear once it arrives.
export function AppShell({ children }: { children: React.ReactNode }) {
  useSSE();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
