import { Document, Schema, Types, model } from 'mongoose';

export interface IQuote extends Document {
  quote: string;
  author: string;
  context: string;
  year: number;
  link: Types.ObjectId;
}

const QuoteSchema = new Schema({
  quote: { type: String, required: true },
  author: { type: String, required: true },
  context: { type: String },
  year: { type: Number },
  link: { type: Types.ObjectId, ref: 'Quote' },
});

// Add indexes for better query performance
QuoteSchema.index({ quote: 'text' }); // Text index for content searching
QuoteSchema.index({ author: 1 }); // Index for author filtering
QuoteSchema.index({ year: 1 }); // Index for year filtering

const QuoteModel = model<IQuote>('Quote', QuoteSchema);

export default QuoteModel;
