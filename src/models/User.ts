import { Schema, model, type Document } from 'mongoose';
import { changeFeedPlugin } from '#/services/changeFeed.js';

export interface IUser extends Document {
  discordId: string;
  username: string;
  name: {
    first?: string;
    last?: string;
  };
  birthday?: Date;
  timezone?: string;
  nicknameAnnounce?: boolean;
  isBot?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    name: {
      first: {
        type: String,
      },
      last: {
        type: String,
      },
    },
    birthday: {
      type: Date,
    },
    timezone: {
      type: String,
    },
    nicknameAnnounce: {
      type: Boolean,
      default: true,
    },
    isBot: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  },
);

// Dashboard tables sort by creation date by default, and analytics group by it
userSchema.index({ createdAt: -1 });
// The dashboard's activity feed lists the most recently changed records
userSchema.index({ updatedAt: -1 });

userSchema.plugin(changeFeedPlugin);

export const User = model<IUser>('User', userSchema);
