import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getSession } from '../middleware/session.js';
import {
  eventBus,
  type DbChangeEvent,
  type BotStatusEvent,
} from '../utils/eventBus.js';

const events = new Hono();

events.get('/', (c) => {
  const session = getSession(c);
  if (!session) return c.text('Unauthorized', 401);

  return streamSSE(c, async (stream) => {
    const onDbChange = (data: DbChangeEvent) => {
      stream
        .writeSSE({ event: 'db:change', data: JSON.stringify(data) })
        .catch(() => {});
    };

    const onBotStatus = (data: BotStatusEvent) => {
      stream
        .writeSSE({ event: 'bot:status', data: JSON.stringify(data) })
        .catch(() => {});
    };

    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: 'heartbeat', data: '' }).catch(() => {});
    }, 30_000);

    stream.onAbort(() => {
      clearInterval(heartbeat);
      eventBus.off('db:change', onDbChange);
      eventBus.off('bot:status', onBotStatus);
    });

    eventBus.on('db:change', onDbChange);
    eventBus.on('bot:status', onBotStatus);

    // Keep stream open
    await new Promise(() => {});
  });
});

export { events };
