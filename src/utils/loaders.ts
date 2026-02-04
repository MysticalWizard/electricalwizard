import type { Client, ClientEvents } from 'discord.js';
import chalk from 'chalk';
import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import type { Event, SlashCommand } from '@/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export async function loadCommands(client: Client): Promise<void> {
  const commandsPath = join(__dirname, '..', 'commands');
  const commandFiles = readdirSync(commandsPath).filter(
    (file) => file.endsWith('.ts') || file.endsWith('.js'),
  );

  console.log(chalk.bold.cyan('⚡ Loaded Commands:'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const { command } = (await import(filePath)) as { command: SlashCommand };

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(chalk.cyan(`  ⌘ ${command.data.name}`));
    } else {
      console.warn(
        chalk.yellow(
          `  ⚠ Command at ${filePath} is missing required "data" or "execute" property.`,
        ),
      );
    }
  }
}

export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = join(__dirname, '..', 'events');
  const eventFiles = readdirSync(eventsPath).filter(
    (file) => file.endsWith('.ts') || file.endsWith('.js'),
  );

  console.log(chalk.bold.magenta('⚡ Loaded Events:'));

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const { event } = (await import(filePath)) as {
      event: Event<keyof ClientEvents>;
    };

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }

    console.log(chalk.magenta(`  ⌁ ${event.name}`));
  }
}
