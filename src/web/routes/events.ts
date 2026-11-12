import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import {
  asViewed,
  refreshSession,
  type Session,
} from '../middleware/session.js';
import { eventBus, type DbChangeEvent } from '../utils/eventBus.js';
import { modelRegistry } from '../utils/models.js';

const HEARTBEAT_MS = 30_000;
// Plenty for one stream per open tab, while bounding what one user can hold
// open
const MAX_STREAMS_PER_USER = 10;

const openStreams = new Map<string, number>();

/**
 * The event as `session` may see it. Members only see their own private
 * records, so they aren't told which of them changed.
 */
function visibleTo(session: Session, event: DbChangeEvent): DbChangeEvent {
  if (session.role !== 'member' || !modelRegistry[event.model]?.hasPrivacy) {
    return event;
  }
  const { model, action, timestamp } = event;
  return { model, action, timestamp };
}

const events = new Hono<AuthEnv>();

// Compressing proxies (including the dashboard's own Next server) hold small
// writes until their buffer fills, so events would never arrive. `no-transform`
// opts the stream out of compression; `X-Accel-Buffering` turns off nginx's
// response buffering. Set after the handler, since streamSSE sets its own
// Cache-Control.
events.use('*', async (c, next) => {
  await next();
  if (c.res.headers.get('Content-Type')?.startsWith('text/event-stream')) {
    c.res.headers.set('Cache-Control', 'no-cache, no-transform');
    c.res.headers.set('X-Accel-Buffering', 'no');
  }
});

events.get('/', requireAuth, (c) => {
  let session = c.get('session');
  const { userId } = session;

  const open = openStreams.get(userId) ?? 0;
  if (open >= MAX_STREAMS_PER_USER) {
    return c.text('Too many open event streams', 429);
  }
  openStreams.set(userId, open + 1);

  return streamSSE(c, async (stream) => {
    // Proxies (the dashboard's Next server among them) pass the headers on
    // only with the first chunk, and the browser counts the stream as open
    // only once it has them, so send one straight away
    await stream.writeSSE({ event: 'ready', data: '' });

    const onDbChange = (data: DbChangeEvent) => {
      stream
        .writeSSE({
          event: 'db:change',
          data: JSON.stringify(visibleTo(session, data)),
        })
        .catch(() => {});
    };

    // Open until the client disconnects or the session ends (expired,
    // revoked, or the user left the guild)
    const { promise: ended, resolve: end } = Promise.withResolvers<void>();
    stream.onAbort(() => end());

    const heartbeat = setInterval(() => {
      void refreshSession(session).then((current) => {
        if (!current) return end();
        session = asViewed(current);
        stream.writeSSE({ event: 'heartbeat', data: '' }).catch(() => {});
      });
    }, HEARTBEAT_MS);

    eventBus.on('db:change', onDbChange);
    await ended;

    clearInterval(heartbeat);
    eventBus.off('db:change', onDbChange);
    const remaining = (openStreams.get(userId) ?? 1) - 1;
    if (remaining > 0) openStreams.set(userId, remaining);
    else openStreams.delete(userId);
  });
});

export { events };
