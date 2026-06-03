'use client';

import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/hooks/use-auth';
import { useDocuments } from '@/api/hooks';

function Section({
  title,
  model,
  userId,
  renderItem,
}: {
  title: string;
  model: string;
  userId: string;
  renderItem: (doc: Record<string, unknown>) => string;
}) {
  const { data } = useDocuments(model, { limit: 50, page: 1, search: '' });
  const items =
    data?.docs.filter(
      (d) =>
        d.userId === userId || d.addedById === userId || d.discordId === userId,
    ) ?? [];

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-bold text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1">
        {items.map((doc) => (
          <div
            key={String(doc._id)}
            className="bg-surface border border-border rounded px-3 py-1.5 text-sm"
          >
            {renderItem(doc)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.userId) >> 22n) % 6}.png`;

  return (
    <AppShell>
      <div className="flex items-center gap-4 mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full" />
        <div>
          <h1 className="text-xl font-bold">{user.username}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {user.role}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Section
          title="My Reminders"
          model="reminders"
          userId={user.userId}
          renderItem={(d) =>
            `${d.message} - ${new Date(d.triggerAt as string).toLocaleString()}`
          }
        />
        <Section
          title="My D-Days"
          model="ddays"
          userId={user.userId}
          renderItem={(d) =>
            `${d.title} - ${new Date(d.targetDate as string).toLocaleDateString()}`
          }
        />
        <Section
          title="Quotes I Added"
          model="quotes"
          userId={user.userId}
          renderItem={(d) => `#${d.quoteNumber} "${d.content}"`}
        />
        <Section
          title="My Nicknames"
          model="nicknames"
          userId={user.userId}
          renderItem={(d) => String(d.nickname)}
        />
      </div>
    </AppShell>
  );
}
