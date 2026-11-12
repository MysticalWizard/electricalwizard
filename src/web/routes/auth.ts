import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { randomBytes } from 'node:crypto';
import { config } from '#/config.js';
import { setDefaultTimezone } from '#/services/user.js';
import {
  getAuthUrl,
  exchangeCode,
  getUser,
  getGuildMember,
} from '../utils/discord.js';
import {
  asViewed,
  createSession,
  setSession,
  getSession,
  endSession,
  roleFor,
} from '../middleware/session.js';

const auth = new Hono();

const oauthCookie = {
  httpOnly: true,
  sameSite: 'Lax',
  secure: config.webBaseUrl.startsWith('https'),
  path: '/',
  maxAge: 300,
} as const;

auth.get('/login', (c) => {
  const state = randomBytes(16).toString('hex');
  setCookie(c, 'oauth_state', state, oauthCookie);

  // The login page passes the browser's timezone, kept until the callback
  const tz = c.req.query('tz');
  if (tz && tz.length <= 64) {
    setCookie(c, 'oauth_tz', tz, oauthCookie);
  } else {
    deleteCookie(c, 'oauth_tz', { path: '/' });
  }

  return c.redirect(getAuthUrl(state));
});

auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');
  const tz = getCookie(c, 'oauth_tz');
  deleteCookie(c, 'oauth_state', { path: '/' });
  deleteCookie(c, 'oauth_tz', { path: '/' });

  if (!code || !state || state !== storedState) {
    return c.text('Invalid OAuth state', 400);
  }

  try {
    const token = await exchangeCode(code);
    const user = await getUser(token.access_token);
    const member = await getGuildMember(token.access_token);

    if (!member.isMember) {
      return c.text('You are not a member of this server.', 403);
    }

    const session = createSession(
      user.id,
      user.username,
      user.avatar,
      roleFor(user.id, member.isAdmin),
      token.access_token,
    );
    setSession(c, session);

    if (tz) {
      try {
        await setDefaultTimezone(user.id, user.username, tz);
      } catch (err) {
        console.error(`Failed to set timezone for ${user.id}:`, err);
      }
    }

    return c.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    return c.text('Authentication failed', 500);
  }
});

// POST, so the Origin check stops other sites from logging users out (which
// revokes their sessions on every device)
auth.post('/logout', async (c) => {
  await endSession(c);
  return c.redirect('/', 303);
});

auth.get('/me', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ authenticated: false }, 401);

  return c.json({
    authenticated: true,
    userId: session.userId,
    username: session.username,
    avatar: session.avatar,
    role: asViewed(session).role,
    actualRole: session.role,
    viewAsMember: asViewed(session) !== session,
  });
});

// Lets an admin or owner see the dashboard with member access. The flag lives
// in the session, so the API enforces it rather than only the UI.
auth.post('/view-as-member', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('Unauthorized', 401);
  if (session.role === 'member') {
    return c.text('Forbidden — admins and owners only', 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.text('Invalid JSON body', 400);
  }
  const enabled = (body as { enabled?: unknown } | null)?.enabled;
  if (typeof enabled !== 'boolean') {
    return c.text('`enabled` must be a boolean', 400);
  }

  setSession(c, { ...session, viewAsMember: enabled });
  return c.json({ viewAsMember: enabled });
});

export { auth };
