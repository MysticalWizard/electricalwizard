import { Client, Collection, GatewayIntentBits } from 'discord.js';
import chalk from 'chalk';
import config from '@/config.js';
import { dbService } from '@/services/database.js';
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

async function main() {
  try {
    console.log(chalk.cyanBright(':: INITIALIZING BOT ::'));

    await dbService.connect();

    loadCommands(client);
    loadEvents(client);

    await client.login(config.bot.token);
  } catch (error) {
    console.error('Failed to start the bot:', error);
    await dbService.disconnect();
    process.exit(1);
  }
}

main();
