import type { Model } from 'mongoose';
import { User } from '@/models/User.js';
import { Guild } from '@/models/Guild.js';
import { Bot } from '@/models/Bot.js';
import { Reminder } from '@/models/Reminder.js';
import { DDay } from '@/models/DDay.js';
import { Quote } from '@/models/Quote.js';
import { Nickname } from '@/models/Nickname.js';

export interface FieldDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required?: boolean;
  enum?: string[];
  readOnly?: boolean;
}

export interface ModelDef {
  model: Model<unknown>;
  fields: FieldDef[];
  hasPrivacy?: boolean;
  ownerField?: string;
  ownerOnly?: boolean;
  readOnly?: boolean;
}

export const modelRegistry: Record<string, ModelDef> = {
  users: {
    model: User as unknown as Model<unknown>,
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'discordId', type: 'string', required: true, readOnly: true },
      { name: 'username', type: 'string', required: true },
      { name: 'name', type: 'object' },
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
      { name: 'guildId', type: 'string', required: true },
      { name: 'channelId', type: 'string', required: true },
      { name: 'userId', type: 'string', required: true },
      { name: 'message', type: 'string', required: true },
      { name: 'triggerAt', type: 'date', required: true },
      { name: 'timezone', type: 'string' },
      { name: 'private', type: 'boolean' },
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
      { name: 'guildId', type: 'string', required: true },
      { name: 'channelId', type: 'string', required: true },
      { name: 'userId', type: 'string', required: true },
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
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
  quotes: {
    model: Quote as unknown as Model<unknown>,
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'guildId', type: 'string', required: true },
      { name: 'quoteNumber', type: 'number', readOnly: true },
      { name: 'content', type: 'string', required: true },
      { name: 'authorId', type: 'string' },
      { name: 'authorName', type: 'string' },
      { name: 'year', type: 'number', required: true },
      { name: 'context', type: 'string' },
      { name: 'addedById', type: 'string' },
      { name: 'messageId', type: 'string' },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
  nicknames: {
    model: Nickname as unknown as Model<unknown>,
    fields: [
      { name: '_id', type: 'string', readOnly: true },
      { name: 'guildId', type: 'string', required: true },
      { name: 'userId', type: 'string', required: true },
      { name: 'nickname', type: 'string', required: true },
      { name: 'createdAt', type: 'date', readOnly: true },
      { name: 'updatedAt', type: 'date', readOnly: true },
    ],
  },
};
