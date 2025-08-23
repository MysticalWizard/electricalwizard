import { Document, SaveOptions, Schema, model } from 'mongoose';

export interface IReminder extends Document {
  userId: string;
  message: string;
  reminderTime: Date;
  timezone: number;
  channelId: string;
  guildId: string | null;
  isPrivate: boolean;
  isCompleted: boolean;
  createdAt: Date;
  save(options?: SaveOptions): Promise<this>;
}

const ReminderSchema = new Schema({
  userId: { type: String, required: true },
  message: { type: String, required: true },
  reminderTime: { type: Date, required: true },
  timezone: { type: Number, default: 0 },
  channelId: { type: String, required: true },
  guildId: { type: String, required: false },
  isPrivate: { type: Boolean, default: false },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

ReminderSchema.index({ reminderTime: 1, isCompleted: 1 });

const ReminderModel = model<IReminder>('Reminder', ReminderSchema);

export default ReminderModel;
