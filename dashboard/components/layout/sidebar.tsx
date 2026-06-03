'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UserCircle, BarChart3, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModels } from '@/api/hooks';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'My Profile', href: '/profile', icon: UserCircle },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

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

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">v4.0.0</p>
      </div>
    </aside>
  );
}
