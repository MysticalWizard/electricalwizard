import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type { Context } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { config } from '#/config.js';
import { getGuildMember, revokeToken } from '../utils/discord.js';

export type Role = 'owner' | 'admin' | 'member';

export interface Session {
  userId: string;
  username: string;
  avatar: string | null;
  role: Role;
  /** Discord OAuth token, used to re-check guild membership and role. */
  accessToken: string;
  /** When membership and role were last confirmed with Discord. */
  checkedAt: number;
  exp: number;
}

const COOKIE_NAME = 'ew_session';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Leaving the guild, losing admin or logging out elsewhere (which revokes the
// token) takes effect within this long.
const RECHECK_MS = 5 * 60 * 1000;
// How soon to try again when Discord couldn't be reached
const RETRY_MS = 30 * 1000;
const ALGORITHM = 'aes-256-gcm';
// Node accepts truncated GCM tags (down to 4 bytes) unless the length is
// pinned, which would let a forged cookie through by guessing 32 bits.
const AUTH_TAG_LENGTH = 16;

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (!_key) {
    _key = createHash('sha256').update(config.webSessionSecret).digest();
  }
  return _key;
}

function encrypt(data: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(token: string): string {
  const [ivB64, tagB64, encB64] = token.split('.');
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Invalid token format');

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

export function roleFor(userId: string, isAdmin: boolean): Role {
  if (userId === config.ownerId) return 'owner';
  return isAdmin ? 'admin' : 'member';
}

export function createSession(
  userId: string,
  username: string,
  avatar: string | null,
  role: Role,
  accessToken: string,
): Session {
  const now = Date.now();
  return {
    userId,
    username,
    avatar,
    role,
    accessToken,
    checkedAt: now,
    exp: now + TTL_MS,
  };
}

export function setSession(c: Context, session: Session): void {
  const token = encrypt(JSON.stringify(session));
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.webBaseUrl.startsWith('https'),
    path: '/',
    // The cookie is rewritten after each re-check, so it must expire with
    // the session rather than a full TTL from now.
    maxAge: Math.floor((session.exp - Date.now()) / 1000),
  });
}

/** The session in a cookie, or null if it's malformed, forged or expired. */
function readSession(token: string): Session | null {
  try {
    const session = JSON.parse(decrypt(token)) as Session;
    // Cookies issued before sessions carried a token can't be re-checked
    if (typeof session.accessToken !== 'string') return null;
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

// Re-checks in flight by access token, so parallel requests and open event
// streams for one session share a single call to Discord
const pendingChecks = new Map<string, Promise<Session | null>>();

/**
 * The session as it stands now: unchanged while its last check is recent,
 * re-checked with Discord once that's older than RECHECK_MS, and null once it
 * has expired, the user has left the guild, or the token was revoked.
 */
export async function refreshSession(
  session: Session,
): Promise<Session | null> {
  if (session.exp <= Date.now()) return null;
  if (Date.now() - session.checkedAt < RECHECK_MS) return session;

  let check = pendingChecks.get(session.accessToken);
  if (!check) {
    check = recheck(session).finally(() =>
      pendingChecks.delete(session.accessToken),
    );
    pendingChecks.set(session.accessToken, check);
  }
  return check;
}

async function recheck(session: Session): Promise<Session | null> {
  let member;
  try {
    member = await getGuildMember(session.accessToken);
  } catch (err) {
    // Discord is down or rate limiting; keep the session and try again soon
    console.error('Session re-check failed:', err);
    return { ...session, checkedAt: Date.now() - RECHECK_MS + RETRY_MS };
  }
  if (!member.isMember) return null;
  return {
    ...session,
    role: roleFor(session.userId, member.isAdmin),
    checkedAt: Date.now(),
  };
}

/**
 * The request's session, re-checked with Discord when due. A re-checked
 * session is written back to the cookie, and an invalid one is cleared.
 */
export async function getSession(c: Context): Promise<Session | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;

  const stored = readSession(token);
  const session = stored && (await refreshSession(stored));
  if (!session) clearSession(c);
  else if (session !== stored) setSession(c, session);
  return session;
}

/**
 * Log out: clear the cookie and revoke the Discord token. Discord revokes
 * every token from the same authorization, so this ends the user's sessions
 * on other devices too, and any copy of this cookie, at their next re-check.
 */
export async function endSession(c: Context): Promise<void> {
  const token = getCookie(c, COOKIE_NAME);
  const session = token ? readSession(token) : null;
  clearSession(c);
  if (!session) return;

  try {
    await revokeToken(session.accessToken);
  } catch (err) {
    console.error('Failed to revoke Discord token:', err);
  }
}

function clearSession(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
