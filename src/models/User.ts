import { Schema, model } from 'mongoose';

const UserSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String },
  name: { type: String },
  birthday: { type: Date },
});

const UserModel = model('User', UserSchema);

export default UserModel;
