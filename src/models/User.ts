import { Document, SaveOptions, Schema, model } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  username: string;
  name: {
    first: {
      given: string;
      preferred: string;
    };
    family: string;
  };
  nicknames: string[];
  birthday: Date;
  save(options?: SaveOptions): Promise<this>;
}

const UserSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  name: {
    first: {
      given: { type: String },
      preferred: { type: String },
    },
    family: { type: String },
  },
  nicknames: [{ type: String }],
  birthday: { type: Date },
});

const UserModel = model<IUser>('User', UserSchema);

export default UserModel;
