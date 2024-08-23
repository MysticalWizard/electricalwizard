import { Schema, model, Types } from 'mongoose';

const StatusSchema = new Schema({
  message: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: Types.ObjectId, ref: 'User' },
});

const StatusModel = model('Status', StatusSchema);

export default StatusModel;
