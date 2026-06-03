'use client';

import { AppShell } from '@/components/layout/app-shell';
import { StatCard } from '@/components/ui/stat-card';
import { useStats, useActivity } from '@/api/hooks';

export default function DashboardPage() {
  const { data: stats } = useStats();
  const { data: activity } = useActivity();

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Users" value={stats.users} />
          <StatCard label="Quotes" value={stats.quotes} />
          <StatCard
            label="Reminders"
            value={stats.reminders}
            subtitle={`${stats.activeReminders} active`}
          />
          <StatCard
            label="D-Days"
            value={stats.ddays}
            subtitle={`${stats.activeDdays} active`}
          />
          <StatCard label="Nicknames" value={stats.nicknames} />
        </div>
      )}

      <h2 className="text-lg font-bold mb-3">Recent Activity</h2>
      <div className="space-y-2">
        {activity?.map((item, i) => {
          const doc = item.doc;
          const summary =
            (doc.title as string) ||
            (doc.content as string) ||
            (doc.nickname as string) ||
            (doc.username as string) ||
            (doc.name as string) ||
            String(doc._id);
          const time = doc.updatedAt
            ? new Date(doc.updatedAt as string).toLocaleString()
            : '';

          return (
            <div
              key={`${item.model}-${String(doc._id)}-${i}`}
              className="flex items-center gap-3 bg-surface-alt border border-border rounded px-3 py-2 text-sm"
            >
              <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs">
                {item.model}
              </span>
              <span className="flex-1 truncate">{summary}</span>
              <span className="text-muted-foreground text-xs">{time}</span>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
