import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type { Context } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { config } from '@/config.js';

export interface Session {
  userId: string;
  username: string;
  avatar: string | null;
  role: 'owner' | 'admin' | 'member';
  exp: number;
}

const COOKIE_NAME = 'ew_session';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ALGORITHM = 'aes-256-gcm';

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

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

export function createSession(
  userId: string,
  username: string,
  avatar: string | null,
  role: 'owner' | 'admin' | 'member',
): Session {
  return { userId, username, avatar, role, exp: Date.now() + TTL_MS };
}

export function setSession(c: Context, session: Session): void {
  const token = encrypt(JSON.stringify(session));
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.webBaseUrl.startsWith('https'),
    path: '/',
    maxAge: TTL_MS / 1000,
  });
}

export function getSession(c: Context): Session | null {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;

  try {
    const session = JSON.parse(decrypt(token)) as Session;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
