import type { Model } from 'mongoose';
import { User } from '#/models/User.js';
import { Guild } from '#/models/Guild.js';
import { Bot } from '#/models/Bot.js';
import { Reminder } from '#/models/Reminder.js';
import { DDay } from '#/models/DDay.js';
import { Quote } from '#/models/Quote.js';
import { Nickname } from '#/models/Nickname.js';

export interface FieldDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required?: boolean;
  enum?: string[];
  readOnly?: boolean;
  /** Holds a Discord ID; writes must be a snowflake. */
  snowflake?: boolean;
  /**
   * Shown to members only on their own record (the one whose owner field
   * holds their ID); admins and the owner always see it.
   */
  memberHidden?: boolean;
}

export interface ModelDef {
  model: Model<unknown>;
  fields: FieldDef[];
  hasPrivacy?: boolean;
  /**
   * Field holding the Discord ID of the user a record belongs to. Used for
   * `?mine=true` lists, and for privacy checks when `hasPrivacy` is set.
   */
  ownerField?: string;
  ownerOnly?: boolean;
  readOnly?: boolean;
}

export const modelRegistry: Record<string, ModelDef> = {
  users: {
    model: User as unknown as Model<unknown>,
    ownerField: 'discordId',
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'discordId', type: 'string', required: true, readOnly: true },
      { name: 'username', type: 'string', required: true },
      // Real names: in Discord only admins can look them up (/user)
      { name: 'name', type: 'object', memberHidden: true },
      { name: 'birthday', type: 'date' },
      { name: 'timezone', type: 'string' },
      { name: 'nicknameAnnounce', type: 'boolean' },
      { name: 'isBot', type: 'boolean' },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
  guilds: {
    model: Guild as unknown as Model<unknown>,
    readOnly: true,
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'guildId', type: 'string', required: true, readOnly: true },
      { name: 'name', type: 'string', required: true },
      { name: 'nicknameAnnounce', type: 'boolean' },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
  bots: {
    model: Bot as unknown as Model<unknown>,
    readOnly: true,
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'clientId', type: 'string', required: true, readOnly: true },
      {
        name: 'status',
        type: 'string',
        enum: ['online', 'idle', 'dnd', 'invisible'],
      },
      {
        name: 'activityType',
        type: 'number',
        enum: ['0', '1', '2', '3', '5'],
      },
      { name: 'activityName', type: 'string' },
      { name: 'startedAt', type: 'date', readOnly: true },
      { name: 'lastSeenAt', type: 'date', readOnly: true },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
  reminders: {
    model: Reminder as unknown as Model<unknown>,
    hasPrivacy: true,
    ownerField: 'userId',
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'guildId', type: 'string', required: true, readOnly: true },
      { name: 'channelId', type: 'string', required: true, snowflake: true },
      { name: 'userId', type: 'string', required: true, snowflake: true },
      { name: 'message', type: 'string', required: true },
      { name: 'triggerAt', type: 'date', required: true },
      { name: 'timezone', type: 'string' },
      { name: 'private', type: 'boolean' },
      { name: 'deliveryAttempts', type: 'number', readOnly: true },
      { name: 'retryAt', type: 'date', readOnly: true },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
  ddays: {
    model: DDay as unknown as Model<unknown>,
    hasPrivacy: true,
    ownerField: 'userId',
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'guildId', type: 'string', required: true, readOnly: true },
      { name: 'channelId', type: 'string', required: true, snowflake: true },
      { name: 'userId', type: 'string', required: true, snowflake: true },
      { name: 'title', type: 'string', required: true },
      { name: 'targetDate', type: 'date', required: true },
      { name: 'timezone', type: 'string' },
      { name: 'recurring', type: 'boolean' },
      { name: 'private', type: 'boolean' },
      {
        name: 'reminderFrequency',
        type: 'string',
        enum: ['everyday', 'everyweek', 'everymonth', 'everyyear'],
      },
      { name: 'nextNotifyAt', type: 'date' },
      { name: 'completed', type: 'boolean' },
      { name: 'completionNotified', type: 'boolean' },
      { name: 'deliveryAttempts', type: 'number', readOnly: true },
      { name: 'retryAt', type: 'date', readOnly: true },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
  quotes: {
    model: Quote as unknown as Model<unknown>,
    ownerField: 'addedById',
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'guildId', type: 'string', required: true, readOnly: true },
      { name: 'quoteNumber', type: 'number', readOnly: true },
      { name: 'content', type: 'string', required: true },
      { name: 'authorId', type: 'string', snowflake: true },
      { name: 'authorName', type: 'string' },
      { name: 'year', type: 'number', required: true },
      { name: 'context', type: 'string' },
      { name: 'addedById', type: 'string', snowflake: true },
      { name: 'messageId', type: 'string', snowflake: true },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
  nicknames: {
    model: Nickname as unknown as Model<unknown>,
    ownerField: 'userId',
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'guildId', type: 'string', required: true, readOnly: true },
      { name: 'userId', type: 'string', required: true, snowflake: true },
      { name: 'nickname', type: 'string', required: true },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
};

/**
 * The registry entry for `name`, or undefined. Names come from URLs, so a
 * plain lookup would also find `constructor`, `__proto__` and the like.
 */
export function getModelDef(name: string): ModelDef | undefined {
  return Object.hasOwn(modelRegistry, name) ? modelRegistry[name] : undefined;
}

const registryKeyByModelName = new Map(
  Object.entries(modelRegistry).map(([key, def]) => [def.model.modelName, key]),
);

/** Registry key (e.g. `ddays`) for a Mongoose model name (e.g. `DDay`). */
export function registryKeyFor(modelName: string): string | undefined {
  return registryKeyByModelName.get(modelName);
}
