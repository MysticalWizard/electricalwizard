import { Client, Collection, GatewayIntentBits } from 'discord.js';
import chalk from 'chalk';
import { config } from '@/config.js';
import { loadCommands, loadEvents } from '@/utils/loaders.js';
import { connectDatabase } from '@/services/database.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

async function main() {
  console.log(chalk.bold('⚒ Initializing bot...'));
  await connectDatabase();
  await loadCommands(client);
  await loadEvents(client);
  await client.login(config.botToken);
}

main();
