import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const mongoHost = process.env.MONGODB_HOST ?? 'localhost:27017';
const mongoDb = process.env.MONGODB_DB ?? 'electricalwizard';
const mongoUser = process.env.MONGODB_USER;
const mongoPassword = process.env.MONGODB_PASSWORD;

const mongoAuth =
  mongoUser && mongoPassword
    ? `${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPassword)}@`
    : '';

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  clientId: requireEnv('CLIENT_ID'),
  guildId: requireEnv('GUILD_ID'),
  ownerId: requireEnv('OWNER_ID'),
  mongoUri: mongoAuth
    ? `mongodb://${mongoAuth}${mongoHost}/${mongoDb}?authSource=admin`
    : `mongodb://${mongoHost}/${mongoDb}`,
  translationApiUrl:
    process.env.TRANSLATION_API_URL ?? 'https://lang.mystwiz.net',
  translationApiKey: requireEnv('TRANSLATION_API_KEY'),
} as const;
