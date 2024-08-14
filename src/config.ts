import dotenv from 'dotenv';

dotenv.config();

const config = {
  bot: {
    token: process.env.BOT_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    ownerId: process.env.OWNER_ID || '',
    prefix: process.env.PREFIX || '!',
    status: process.env.STATUS || '',
    env: process.env.NODE_ENV || 'development',
  },
  guild: {
    id: process.env.GUILD_ID || '',
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/discordbot',
  },
  commands: {
    defaultGlobal: false,
  },
  cooldowns: {
    slashCommand: 3, // in seconds
  },
};

// Validate required configuration
const requiredEnvVars = ['BOT_TOKEN', 'CLIENT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export default config;
