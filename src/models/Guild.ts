import { Schema, model } from 'mongoose';

const GuildSchema = new Schema({
  guildId: { required: true, type: String },
  prefix: { type: String, default: process.env.PREFIX },
  welcomeChannelId: { type: String, default: null },
});

const GuildModel = model('Guild', GuildSchema);

export default GuildModel;
