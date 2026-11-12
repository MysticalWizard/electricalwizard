import { Schema, model, type Document } from 'mongoose';
import { changeFeedPlugin } from '#/services/changeFeed.js';

export interface IReminder extends Document {
  guildId: string;
  channelId: string;
  userId: string;
  message: string;
  triggerAt: Date;
  timezone?: string;
  private: boolean;
  /** Failed deliveries so far; the reminder is dropped after a few. */
  deliveryAttempts: number;
  /** When to try a failed delivery again. */
  retryAt?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<IReminder>(
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
    message: {
      type: String,
      required: true,
    },
    triggerAt: {
      type: Date,
      required: true,
    },
    timezone: {
      type: String,
    },
    private: {
      type: Boolean,
      default: false,
    },
    deliveryAttempts: {
      type: Number,
      default: 0,
    },
    retryAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

reminderSchema.index({ triggerAt: 1 });
reminderSchema.index({ userId: 1, guildId: 1 });

// Private records: only their owner is told about changes
reminderSchema.plugin(changeFeedPlugin, { ownerField: 'userId' });

export const Reminder = model<IReminder>('Reminder', reminderSchema);
