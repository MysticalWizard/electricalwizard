import { ActivityType } from 'discord.js';

export const BotStatus = {
  Online: 'online',
  Idle: 'idle',
  DoNotDisturb: 'dnd',
  Invisible: 'invisible',
} as const;

export type BotStatusType = (typeof BotStatus)[keyof typeof BotStatus];

export const BotActivityType = {
  Playing: ActivityType.Playing,
  Streaming: ActivityType.Streaming,
  Listening: ActivityType.Listening,
  Watching: ActivityType.Watching,
  Competing: ActivityType.Competing,
  Custom: ActivityType.Custom,
} as const;

export type BotActivity =
  (typeof BotActivityType)[keyof typeof BotActivityType] | null;
