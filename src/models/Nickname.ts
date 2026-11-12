import { Schema, model, type Document } from 'mongoose';
import { changeFeedPlugin } from '#/services/changeFeed.js';

/**
 * Lowercased nickname. Nicknames are unique per guild regardless of case, and
 * lookups match this by equality, which an index can serve (a
 * case-insensitive regex can't).
 */
export function nicknameKey(nickname: string): string {
  return nickname.toLowerCase();
}

export interface INickname extends Document {
  guildId: string;
  userId: string;
  nickname: string;
  nicknameKey?: string;
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
    // Derived from nickname by the hooks below; not edited directly
    nicknameKey: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Keep nicknameKey in sync with nickname on saves and on query updates (the
// dashboard edits nicknames with findByIdAndUpdate)
nicknameSchema.pre('save', function () {
  if (this.isModified('nickname')) {
    this.nicknameKey = nicknameKey(this.nickname);
  }
});

nicknameSchema.pre(
  ['findOneAndUpdate', 'updateOne', 'updateMany'],
  function () {
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) return;
    const nickname: unknown = update.$set?.nickname ?? update.nickname;
    if (typeof nickname === 'string') {
      this.set('nicknameKey', nicknameKey(nickname));
    }
  },
);

// Compound index: each nickname must be unique within a guild
nicknameSchema.index({ guildId: 1, nickname: 1 }, { unique: true });

// The same, ignoring case. Partial so it can be built before older nicknames
// get their key (see backfillNicknameKeys).
nicknameSchema.index(
  { guildId: 1, nicknameKey: 1 },
  { unique: true, partialFilterExpression: { nicknameKey: { $exists: true } } },
);

// Index for efficient lookup by user within a guild
nicknameSchema.index({ guildId: 1, userId: 1 });

// Dashboard tables sort by creation date by default, and analytics group by it
nicknameSchema.index({ createdAt: -1 });
// The dashboard's activity feed lists the most recently changed records
nicknameSchema.index({ updatedAt: -1 });

nicknameSchema.plugin(changeFeedPlugin);

export const Nickname = model<INickname>('Nickname', nicknameSchema);
