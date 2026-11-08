'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CircleUser, ChartColumn, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModels } from '@/api/hooks';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'My Profile', href: '/profile', icon: CircleUser },
  { label: 'Analytics', href: '/analytics', icon: ChartColumn },
];

const REPO_URL = 'https://github.com/MysticalWizard/electricalwizard';

// lucide-react no longer ships brand icons
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: models } = useModels();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="w-56 bg-surface-alt border-r border-border flex flex-col h-screen shrink-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">ElectricalWizard</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-1.5 rounded text-sm transition-colors',
              isActive(item.href)
                ? 'bg-accent text-white'
                : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}

        {models && models.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground uppercase tracking-wider pt-4 pb-1 px-3">
              Data
            </div>
            {models.map((m) => (
              <Link
                key={m.name}
                href={`/data/${m.name}`}
                className={cn(
                  'block px-3 py-1.5 rounded text-sm transition-colors',
                  isActive(`/data/${m.name}`)
                    ? 'bg-accent text-white'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                )}
              >
                {m.name}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">v4.0.0</p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          title="GitHub repository"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <GitHubIcon className="h-4 w-4" />
        </a>
      </div>
    </aside>
  );
}
