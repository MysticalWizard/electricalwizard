'use client';

import { useAuth } from '@/hooks/use-auth';
import { useDocuments } from '@/api/hooks';

/**
 * The caller's own documents of `model`. `mine` is `'true'` to match on the
 * model's owner field, or the name of another Discord ID field.
 */
function useMine(model: string, mine = 'true') {
  const { data } = useDocuments(model, {
    limit: 50,
    page: 1,
    search: '',
    mine,
  });
  return data?.docs ?? [];
}

function Section({
  title,
  model,
  mine,
  renderItem,
}: {
  title: string;
  model: string;
  mine?: string;
  renderItem: (doc: Record<string, unknown>) => string;
}) {
  const items = useMine(model, mine);

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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The bot stores a birthday as midnight in the server's own timezone, so the
 * date is read from the nearest UTC midnight. That holds for any server
 * offset within ±12 hours, wherever the browser is.
 */
function formatBirthday(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return value;
  return new Date(Math.round(time / DAY_MS) * DAY_MS).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' },
  );
}

/** `timezone` with its current local time, or just the name if it's unknown. */
function formatTimezone(timezone: string): string {
  try {
    const now = new Date().toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
    return `${timezone} (${now} now)`;
  } catch {
    return timezone;
  }
}

function Details() {
  const [me] = useMine('users');
  const birthday = typeof me?.birthday === 'string' ? me.birthday : undefined;
  const timezone = typeof me?.timezone === 'string' ? me.timezone : undefined;

  const rows = [
    {
      label: 'Birthday',
      value: birthday ? formatBirthday(birthday) : undefined,
      hint: '/bday',
    },
    {
      label: 'Timezone',
      value: timezone ? formatTimezone(timezone) : undefined,
      hint: '/timezone set',
    },
  ];

  return (
    <dl className="bg-surface border border-border rounded px-3 py-2 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {rows.map(({ label, value, hint }) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>
            {value ?? (
              <span className="text-muted-foreground">
                Not set. Use <code>{hint}</code> in Discord.
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.userId) >> 22n) % 6}.png`;

  return (
    <>
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
        <Details />
        <Section
          title="My Reminders"
          model="reminders"
          renderItem={(d) =>
            `${d.message} - ${new Date(d.triggerAt as string).toLocaleString()}`
          }
        />
        <Section
          title="My D-Days"
          model="ddays"
          renderItem={(d) =>
            `${d.title} - ${new Date(d.targetDate as string).toLocaleDateString()}`
          }
        />
        <Section
          title="My Quotes"
          model="quotes"
          mine="authorId"
          renderItem={(d) => `#${d.quoteNumber} "${d.content}" - ${d.year}`}
        />
        <Section
          title="Quotes I Added"
          model="quotes"
          renderItem={(d) => `#${d.quoteNumber} "${d.content}"`}
        />
        <Section
          title="My Nicknames"
          model="nicknames"
          renderItem={(d) => String(d.nickname)}
        />
      </div>
    </>
  );
}
