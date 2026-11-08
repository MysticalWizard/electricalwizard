import { Schema, model, type Document } from 'mongoose';
import { changeFeedPlugin } from '#/services/changeFeed.js';

/** How many translations were asked for in a guild on one UTC day. */
export interface ITranslationCount extends Document {
  guildId: string;
  /** Midnight UTC of the day counted. */
  date: Date;
  success?: number;
  failed?: number;
}

const translationCountSchema = new Schema<ITranslationCount>({
  guildId: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  // No defaults: both are only ever $inc'd, and a missing count is zero
  success: {
    type: Number,
  },
  failed: {
    type: Number,
  },
});

translationCountSchema.index({ guildId: 1, date: 1 }, { unique: true });
translationCountSchema.index({ date: 1 });

translationCountSchema.plugin(changeFeedPlugin);

export const TranslationCount = model<ITranslationCount>(
  'TranslationCount',
  translationCountSchema,
);
