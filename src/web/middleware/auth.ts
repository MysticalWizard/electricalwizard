import type { Context, Next } from 'hono';
import { getSession } from './session.js';

export async function requireAuth(
  c: Context,
  next: Next,
): Promise<Response | void> {
  const session = getSession(c);
  if (!session) {
    return c.text('Unauthorized', 401);
  }
  await next();
}

export async function requireOwner(
  c: Context,
  next: Next,
): Promise<Response | void> {
  const session = getSession(c);
  if (!session) {
    return c.text('Unauthorized', 401);
  }
  if (session.role !== 'owner') {
    return c.text('Forbidden — owner only', 403);
  }
  await next();
}
