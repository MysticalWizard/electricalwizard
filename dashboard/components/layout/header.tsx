'use client';

import { useAuth } from '@/hooks/use-auth';

export function Header() {
  const { user } = useAuth();
  if (!user) return null;

  const roleBadge =
    user.role === 'owner'
      ? 'bg-warning/20 text-warning'
      : user.role === 'admin'
        ? 'bg-accent/20 text-accent'
        : 'bg-muted/20 text-muted-foreground';

  const roleLabel =
    user.role === 'owner'
      ? 'Owner'
      : user.role === 'admin'
        ? 'Admin'
        : 'Read Only';

  return (
    <header className="h-12 border-b border-border flex items-center justify-end px-4 gap-3 shrink-0">
      <span className={`text-xs px-2 py-0.5 rounded ${roleBadge}`}>
        {roleLabel}
      </span>
      <span className="text-sm">{user.username}</span>
      <a
        href="/auth/logout"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Logout
      </a>
    </header>
  );
}
