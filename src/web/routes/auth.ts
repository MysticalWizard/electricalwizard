import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { randomBytes } from 'node:crypto';
import { config } from '@/config.js';
import {
  getAuthUrl,
  exchangeCode,
  getUser,
  getGuildMember,
} from '../utils/discord.js';
import {
  createSession,
  setSession,
  getSession,
  clearSession,
} from '../middleware/session.js';

const auth = new Hono();

auth.get('/login', (c) => {
  const state = randomBytes(16).toString('hex');
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.webBaseUrl.startsWith('https'),
    path: '/',
    maxAge: 300,
  });
  return c.redirect(getAuthUrl(state));
});

auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');
  deleteCookie(c, 'oauth_state', { path: '/' });

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

    const role =
      user.id === config.ownerId
        ? 'owner'
        : member.isAdmin
          ? 'admin'
          : 'member';

    const session = createSession(user.id, user.username, user.avatar, role);
    setSession(c, session);

    return c.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    return c.text('Authentication failed', 500);
  }
});

auth.get('/logout', (c) => {
  clearSession(c);
  return c.redirect('/');
});

auth.get('/me', (c) => {
  const session = getSession(c);
  if (!session) return c.json({ authenticated: false }, 401);

  return c.json({
    authenticated: true,
    userId: session.userId,
    username: session.username,
    avatar: session.avatar,
    role: session.role,
  });
});

export { auth };
