'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { BotUptime } from './bot-uptime';

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
      <BotUptime />
      <span className={`text-xs px-2 py-0.5 rounded ${roleBadge}`}>
        {roleLabel}
      </span>
      <Link href="/profile" className="text-sm hover:underline">
        {user.username}
      </Link>
      <form method="post" action="/auth/logout">
        <button
          type="submit"
          className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Logout
        </button>
      </form>
    </header>
  );
}
