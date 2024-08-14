import { Client, Collection, GatewayIntentBits } from 'discord.js';
import config from '@/config.js';
import { loadCommands, loadEvents } from '@/utils/loaders.js';

/**
 * The Discord client instance.
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

loadCommands(client);
loadEvents(client);

client.login(config.bot.token);
