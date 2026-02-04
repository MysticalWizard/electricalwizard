import { Schema, model, type Document } from 'mongoose';

export interface INickname extends Document {
  guildId: string;
  userId: string;
  nickname: string;
  createdAt: Date;
  updatedAt: Date;
}

const nicknameSchema = new Schema<INickname>(
  {
    guildId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    nickname: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index: each nickname must be unique within a guild
nicknameSchema.index({ guildId: 1, nickname: 1 }, { unique: true });

// Index for efficient lookup by user within a guild
nicknameSchema.index({ guildId: 1, userId: 1 });

export const Nickname = model<INickname>('Nickname', nicknameSchema);
