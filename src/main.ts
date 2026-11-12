import { Client, Collection, GatewayIntentBits } from 'discord.js';
import chalk from 'chalk';
import { config } from '#/config.js';
import { loadCommands, loadEvents } from '#/utils/loaders.js';
import { connectDatabase } from '#/services/database.js';
import { watchChangeFeed } from '#/services/changeFeed.js';
import {
  backfillNicknameKeys,
  invalidateNicknameCache,
} from '#/services/nickname.js';
import { backfillQuoteContentKeys } from '#/services/quote.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // Reply to a deleted message as a plain message instead of failing
  failIfNotExists: false,
  // Replies that echo user text (quotes, teams) must not ping anyone named
  // in it. Messages that do ping pass their own allow-list.
  allowedMentions: { parse: [] },
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

// A stray rejection is logged rather than ending the process, which would
// take the bot offline until pm2 restarts it.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

client.commands = new Collection();

async function main() {
  console.log(chalk.bold('⚒ Initializing bot...'));
  await connectDatabase();
  await backfillQuoteContentKeys();
  await backfillNicknameKeys();
  // Drop cached data when either process writes to the models behind it.
  void watchChangeFeed((entry) => invalidateNicknameCache(entry.model));
  await loadCommands(client);
  await loadEvents(client);
  await client.login(config.botToken);
}

main().catch((error: unknown) => {
  console.error('Failed to start the bot:', error);
  process.exit(1);
});
