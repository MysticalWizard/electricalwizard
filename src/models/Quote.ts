import { Schema, model, type Document } from 'mongoose';

// Counter schema for per-guild auto-increment
const counterSchema = new Schema({
  _id: { type: String, required: true }, // e.g., "quote_123456789" (quote_guildId)
  seq: { type: Number, default: 0 },
});

export const Counter = model('Counter', counterSchema);

export interface IQuote extends Document {
  guildId: string;
  quoteNumber: number;
  content: string;
  authorId?: string;
  authorName?: string;
  year: number;
  context?: string;
  addedById?: string;
  messageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<IQuote>(
  {
    guildId: {
      type: String,
      required: true,
    },
    quoteNumber: {
      type: Number,
    },
    content: {
      type: String,
      required: true,
    },
    authorId: {
      type: String,
    },
    authorName: {
      type: String,
    },
    year: {
      type: Number,
      required: true,
    },
    context: {
      type: String,
    },
    addedById: {
      type: String,
    },
    messageId: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Auto-increment quoteNumber per guild before save
quoteSchema.pre('save', async function () {
  if (this.isNew && !this.quoteNumber) {
    const counter = await Counter.findByIdAndUpdate(
      `quote_${this.guildId}`,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    this.quoteNumber = counter.seq;
  }
});

quoteSchema.index({ guildId: 1, quoteNumber: 1 }, { unique: true });
quoteSchema.index({ guildId: 1, authorId: 1 });
quoteSchema.index({ guildId: 1, year: 1 });

export const Quote = model<IQuote>('Quote', quoteSchema);
