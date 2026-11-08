import type { Client } from 'discord.js';
import { config } from '#/config.js';
import { Bot } from '#/models/Bot.js';

const SEEN_INTERVAL = 30_000;
/** How long without a heartbeat before the bot counts as offline. */
const OFFLINE_AFTER = 3 * SEEN_INTERVAL;

export interface BotUptime {
  online: boolean;
  /** ISO time the bot became ready; null while it's offline. */
  startedAt: string | null;
}

/**
 * Record when the bot became ready, then keep marking it as alive so the
 * dashboard API (a separate process) can tell whether it's still running.
 */
export async function startUptimeTracking(client: Client<true>): Promise<void> {
  await Bot.updateOne(
    { clientId: config.clientId },
    { $set: { startedAt: client.readyAt, lastSeenAt: new Date() } },
  );

  setInterval(() => {
    // Through the driver, so heartbeats skip the change feed and don't bump
    // updatedAt: they aren't changes the dashboard needs to hear about.
    Bot.collection
      .updateOne(
        { clientId: config.clientId },
        { $set: { lastSeenAt: new Date() } },
      )
      .catch((error: unknown) => {
        console.error('Failed to record bot heartbeat:', error);
      });
  }, SEEN_INTERVAL);
}

export async function getBotUptime(): Promise<BotUptime> {
  const bot = await Bot.findOne(
    { clientId: config.clientId },
    { startedAt: 1, lastSeenAt: 1 },
  ).lean();

  const online =
    !!bot?.startedAt &&
    !!bot.lastSeenAt &&
    Date.now() - bot.lastSeenAt.getTime() < OFFLINE_AFTER;

  return {
    online,
    startedAt: online && bot?.startedAt ? bot.startedAt.toISOString() : null,
  };
}
