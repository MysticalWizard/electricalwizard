import { Schema, model, type Document } from 'mongoose';

export interface IReminder extends Document {
  guildId: string;
  channelId: string;
  userId: string;
  message: string;
  triggerAt: Date;
  timezone?: string;
  private: boolean;
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
  },
  {
    timestamps: true,
  },
);

reminderSchema.index({ triggerAt: 1 });
reminderSchema.index({ userId: 1, guildId: 1 });

export const Reminder = model<IReminder>('Reminder', reminderSchema);
