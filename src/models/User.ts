import { Schema, model, type Document } from 'mongoose';

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

export const User = model<IUser>('User', userSchema);
