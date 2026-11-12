import { createMiddleware } from 'hono/factory';
import { asViewed, getSession, type Session } from './session.js';

/**
 * Routes behind these middlewares read the session with `c.get('session')`.
 * While viewing as a member, its role is `member`.
 */
export type AuthEnv = { Variables: { session: Session } };

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const stored = await getSession(c);
  const session = stored && asViewed(stored);
  if (!session) {
    return c.text('Unauthorized', 401);
  }
  c.set('session', session);
  await next();
});

export const requireOwner = createMiddleware<AuthEnv>(async (c, next) => {
  const stored = await getSession(c);
  const session = stored && asViewed(stored);
  if (!session) {
    return c.text('Unauthorized', 401);
  }
  if (session.role !== 'owner') {
    return c.text('Forbidden — owner only', 403);
  }
  c.set('session', session);
  await next();
});
