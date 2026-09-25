export type UserRole = 'owner' | 'admin' | 'member';

export interface SessionUser {
  authenticated: boolean;
  userId: string;
  username: string;
  avatar: string | null;
  role: UserRole;
}

export interface FieldDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required?: boolean;
  enum?: string[];
  readOnly?: boolean;
}

export interface ModelDef {
  name: string;
  fields: FieldDef[];
  ownerOnly: boolean;
  readOnly: boolean;
}

export interface PaginatedResponse<T> {
  docs: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Stats {
  users: number;
  guilds: number;
  bots: number;
  reminders: number;
  ddays: number;
  quotes: number;
  nicknames: number;
  activeReminders: number;
  activeDdays: number;
}

export interface ActivityItem {
  model: string;
  doc: Record<string, unknown>;
}

export interface AnalyticsPoint {
  date: string;
  count: number;
}

export interface DbChangeEvent {
  /** Model registry key, e.g. `ddays`. */
  model: string;
  action: 'create' | 'update' | 'delete';
  /** Absent for writes that can touch several documents. */
  id?: string;
  timestamp: number;
}

export interface SSEEvent {
  type: 'db:change';
  data: DbChangeEvent;
}
