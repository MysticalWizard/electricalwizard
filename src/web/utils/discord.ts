import { config } from '#/config.js';

const API = 'https://discord.com/api/v10';
const REDIRECT_URI = `${config.webBaseUrl}/auth/callback`;

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state,
  });
  return `${API}/oauth2/authorize?${params}`;
}

export async function exchangeCode(
  code: string,
): Promise<{ access_token: string; token_type: string }> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.discordClientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; token_type: string }>;
}

export async function getUser(
  accessToken: string,
): Promise<{ id: string; username: string; avatar: string | null }> {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json() as Promise<{
    id: string;
    username: string;
    avatar: string | null;
  }>;
}

export async function getGuildMember(
  accessToken: string,
): Promise<{ isMember: boolean; isAdmin: boolean }> {
  const res = await fetch(`${API}/users/@me/guilds/${config.guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Not in the guild, or the token was revoked. Other failures (rate limits,
  // outages) mean membership couldn't be checked, so they throw instead.
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return { isMember: false, isAdmin: false };
  }
  if (!res.ok) throw new Error(`Failed to fetch guild member: ${res.status}`);

  const data = (await res.json()) as { permissions?: string };
  const perms = BigInt(data.permissions ?? '0');
  const ADMINISTRATOR = 0x8n;

  return { isMember: true, isAdmin: (perms & ADMINISTRATOR) === ADMINISTRATOR };
}

/**
 * Revoke an access token. Discord revokes every token from the same
 * authorization along with it.
 */
export async function revokeToken(accessToken: string): Promise<void> {
  const res = await fetch(`${API}/oauth2/token/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.discordClientSecret,
      token: accessToken,
      token_type_hint: 'access_token',
    }),
  });

  if (!res.ok) throw new Error(`Token revocation failed: ${res.status}`);
}
