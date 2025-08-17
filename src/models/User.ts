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
  birthdayTimezone: number;
  lastBirthdayNotification: Date;
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
  birthdayTimezone: { type: Number, default: 0 }, // Default to UTC
  lastBirthdayNotification: { type: Date }, // Track last notification to prevent duplicates
});

const UserModel = model<IUser>('User', UserSchema);

export default UserModel;
