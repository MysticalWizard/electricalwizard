import { Schema, model, type Document } from 'mongoose';

export interface IGuild extends Document {
  guildId: string;
  name: string;
  nicknameAnnounce?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const guildSchema = new Schema<IGuild>(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    nicknameAnnounce: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Guild = model<IGuild>('Guild', guildSchema);
