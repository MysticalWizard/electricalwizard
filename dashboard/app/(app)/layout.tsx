import { AppShell } from '@/components/layout/app-shell';

// Shared by every logged-in page so the shell (and its SSE connection) stays
// mounted across navigations.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
