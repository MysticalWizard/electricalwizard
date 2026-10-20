import type { Client } from 'discord.js';
import { config } from '#/config.js';

const STATUS_URL = 'https://status.mystwiz.net/api/heartbeat/electricalwizard';
const HEARTBEAT_INTERVAL = 64_000;

/**
 * Report to status.mystwiz.net that the bot is connected, along with its
 * gateway latency. Nothing is sent while the gateway connection is down, so
 * the status page marks the bot offline once heartbeats stop arriving.
 */
async function sendHeartbeat(client: Client, token: string): Promise<void> {
  if (!client.isReady()) return;
  const ping = client.ws.ping;
  try {
    await fetch(STATUS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latencyMs: ping >= 0 ? ping : null }),
      signal: AbortSignal.timeout(8192),
    });
  } catch {
    // The status page being unreachable must never affect the bot.
  }
}

/**
 * Start sending heartbeats. Does nothing unless STATUS_HEARTBEAT_TOKEN is set.
 */
export function startHeartbeat(client: Client): void {
  const token = config.statusHeartbeatToken;
  if (!token) return;

  void sendHeartbeat(client, token);
  setInterval(() => {
    void sendHeartbeat(client, token);
  }, HEARTBEAT_INTERVAL);
}
