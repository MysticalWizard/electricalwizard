import { Schema, model, type Document } from 'mongoose';
import { changeFeedPlugin } from '#/services/changeFeed.js';

export type ReminderFrequency =
  'everyday' | 'everyweek' | 'everymonth' | 'everyyear' | null;

export interface IDDay extends Document {
  guildId: string;
  channelId: string;
  userId: string;
  title: string;
  targetDate: Date;
  timezone?: string;
  recurring: boolean;
  private: boolean;
  reminderFrequency: ReminderFrequency;
  nextNotifyAt: Date | null;
  completed: boolean;
  completionNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ddaySchema = new Schema<IDDay>(
  {
    guildId: {
      type: String,
      required: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    targetDate: {
      type: Date,
      required: true,
    },
    timezone: {
      type: String,
    },
    recurring: {
      type: Boolean,
      default: false,
    },
    private: {
      type: Boolean,
      default: false,
    },
    reminderFrequency: {
      type: String,
      enum: ['everyday', 'everyweek', 'everymonth', 'everyyear', null],
      default: null,
    },
    nextNotifyAt: {
      type: Date,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completionNotified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

ddaySchema.index({ nextNotifyAt: 1 });
ddaySchema.index({ userId: 1, guildId: 1 });
// Equality field first so the scheduler's { completed: false, targetDate <= now }
// poll doesn't scan the ever-growing set of completed D-Days
ddaySchema.index({ completed: 1, targetDate: 1 });

ddaySchema.plugin(changeFeedPlugin);

export const DDay = model<IDDay>('DDay', ddaySchema);
