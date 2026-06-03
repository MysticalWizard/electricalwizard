import type { SessionUser } from '@electricalwizard/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts?.headers as Record<string, string>),
  };
  if (opts?.body) {
    headers['Content-Type'] ??= 'application/json';
  }

  const res = await fetch(path, { ...opts, headers });

  if (res.status === 401) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export function fetchMe(): Promise<SessionUser> {
  return api<SessionUser>('/auth/me');
}
