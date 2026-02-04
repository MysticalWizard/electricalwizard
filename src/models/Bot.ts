import { Schema, model, type Document } from 'mongoose';
import {
  BotStatus,
  BotActivityType,
  type BotStatusType,
  type BotActivity,
} from '@/enums.js';

export interface IBot extends Document {
  clientId: string;
  status: BotStatusType;
  activityType: BotActivity;
  activityName: string;
  createdAt: Date;
  updatedAt: Date;
}

const botSchema = new Schema<IBot>(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(BotStatus),
      default: BotStatus.Online,
    },
    activityType: {
      type: Number,
      enum: Object.values(BotActivityType),
      default: null,
    },
    activityName: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

export const Bot = model<IBot>('Bot', botSchema);
