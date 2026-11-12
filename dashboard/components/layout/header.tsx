'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { setViewAsMember } from '@/api/client';
import { useAuth } from '@/hooks/use-auth';
import { BotUptime } from './bot-uptime';

function ViewAsMemberToggle({ active }: { active: boolean }) {
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    setPending(true);
    try {
      await setViewAsMember(!active);
      // Every query, the event stream and the auth state depend on the role,
      // so start over from a clean slate
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch view:', err);
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pending}
      title={
        active
          ? 'Return to your own access'
          : 'See the dashboard as a member would'
      }
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded cursor-pointer disabled:opacity-50 ${
        active
          ? 'bg-warning/20 text-warning hover:bg-warning/30'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      {active ? 'Exit member view' : 'View as member'}
    </button>
  );
}

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
      {user.actualRole !== 'member' && (
        <ViewAsMemberToggle active={user.viewAsMember} />
      )}
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
