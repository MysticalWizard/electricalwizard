import { createMiddleware } from 'hono/factory';
import { getSession, type Session } from './session.js';

/** Routes behind these middlewares read the session with `c.get('session')`. */
export type AuthEnv = { Variables: { session: Session } };

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await getSession(c);
  if (!session) {
    return c.text('Unauthorized', 401);
  }
  c.set('session', session);
  await next();
});

export const requireOwner = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await getSession(c);
  if (!session) {
    return c.text('Unauthorized', 401);
  }
  if (session.role !== 'owner') {
    return c.text('Forbidden — owner only', 403);
  }
  c.set('session', session);
  await next();
});
