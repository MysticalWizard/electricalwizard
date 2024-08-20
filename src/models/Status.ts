import { Schema, model } from 'mongoose';

const StatusSchema = new Schema({
  message: { type: String, required: true },
});

const StatusModel = model('Status', StatusSchema);

export default StatusModel;
