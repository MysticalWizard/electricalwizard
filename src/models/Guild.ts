import { Document, Schema, model } from 'mongoose';

export interface IGuild extends Document {
  guildId: string;
  prefix: string;
  botChannelId: string | null;
  welcomeChannelId: string | null;
  birthdayChannelId: string | null;
}

const GuildSchema = new Schema({
  guildId: { required: true, type: String },
  prefix: { type: String, default: process.env.PREFIX },
  botChannelId: { type: String, default: null },
  welcomeChannelId: { type: String, default: null },
  birthdayChannelId: { type: String, default: null },
});

const GuildModel = model<IGuild>('Guild', GuildSchema);

export default GuildModel;
