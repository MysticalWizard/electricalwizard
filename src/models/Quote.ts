import { Schema, model } from 'mongoose';

const QuoteSchema = new Schema({
  quote: { type: String, required: true },
  author: { type: String, required: true },
  context: { type: String },
  year: { type: Number },
});

const QuoteModel = model('Quote', QuoteSchema);

export default QuoteModel;
