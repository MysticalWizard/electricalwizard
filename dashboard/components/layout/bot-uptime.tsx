'use client';

import { useEffect, useState } from 'react';
import { useBotUptime } from '@/api/hooks';

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  return days > 0 ? `${days}d ${clock}` : clock;
}

/** The bot's online state and how long it has been up, ticking each second. */
export function BotUptime() {
  const { data } = useBotUptime();
  const [now, setNow] = useState(() => Date.now());

  const startedAt = data?.startedAt ? Date.parse(data.startedAt) : null;

  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!data) return null;

  return (
    <div
      className="mr-auto flex items-center gap-2 text-xs text-muted-foreground"
      title={
        startedAt !== null
          ? `Bot up since ${new Date(startedAt).toLocaleString()}`
          : 'Bot is offline'
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${
          startedAt !== null ? 'bg-success' : 'bg-destructive'
        }`}
      />
      {startedAt !== null ? (
        <span>
          Uptime{' '}
          <span className="font-mono tabular-nums text-foreground">
            {formatDuration(now - startedAt)}
          </span>
        </span>
      ) : (
        <span>Offline</span>
      )}
    </div>
  );
}
