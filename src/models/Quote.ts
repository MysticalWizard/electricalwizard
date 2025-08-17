import { Document, Schema, Types, model } from 'mongoose';

export interface IQuote extends Document {
  _id: Types.ObjectId; // Explicitly define the _id type
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
QuoteSchema.index({ author: 1, year: 1 }); // Compound for author+year queries
QuoteSchema.index({ year: 1, author: 1 }); // Reverse for year+author queries
QuoteSchema.index({ author: 'text', quote: 'text' }, { 
  weights: { quote: 10, author: 5 },
  name: 'search_index'
}); // Enhanced text search with weights
QuoteSchema.index({ _id: 1 }, { background: true }); // Explicit for sorting
QuoteSchema.index({ author: 1 }); // Keep individual author index
QuoteSchema.index({ year: 1 }); // Keep individual year index

const QuoteModel = model<IQuote>('Quote', QuoteSchema);

export default QuoteModel;
