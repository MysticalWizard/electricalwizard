import {
  REST,
  Routes,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { readdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import config from '@/config.js';
import type { SlashCommand } from '@/types';
import { validFileExtension } from '@/utils/helpers.js';

const globalCommands: RESTPostAPIApplicationCommandsJSONBody[] = [];
const guildCommands: RESTPostAPIApplicationCommandsJSONBody[] = [];

async function loadCommands(dir: string): Promise<void> {
  const items = await readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const itemPath = join(dir, item.name);

    if (item.isDirectory()) {
      await loadCommands(itemPath);
    } else if (item.isFile() && item.name.endsWith(validFileExtension)) {
      try {
        const { default: command } = (await import(itemPath)) as {
          default: SlashCommand;
        };

        if ('data' in command && 'execute' in command) {
          ((command.global ?? config.commands.defaultGlobal)
            ? globalCommands
            : guildCommands
          ).push(command.data.toJSON());
        } else {
          console.log(
            chalk.yellow(
              `[WARNING] The command at ${itemPath} is missing a required "data" or "execute" property.`,
            ),
          );
        }
      } catch (error) {
        console.error(
          chalk.red(`[ERROR] Failed to load command at ${itemPath}:`),
          error,
        );
      }
    }
  }
}

const rest = new REST({ version: '10' }).setToken(config.bot.token);

async function deployCommands(): Promise<void> {
  try {
    const commandsPath = join(import.meta.dirname, 'commands');
    await loadCommands(commandsPath);

    if (globalCommands.length > 0) {
      const globalData = (await rest.put(
        Routes.applicationCommands(config.bot.clientId),
        { body: globalCommands },
      )) as RESTPostAPIApplicationCommandsJSONBody[];

      console.log(
        chalk.green(
          `Successfully reloaded ${globalData.length} global application (/) commands.`,
        ),
      );
      globalData.forEach((command) =>
        console.log(chalk.blue(`- ${command.name}`)),
      );
    }

    if (config.guild.id && guildCommands.length > 0) {
      const guildData = (await rest.put(
        Routes.applicationGuildCommands(config.bot.clientId, config.guild.id),
        { body: guildCommands },
      )) as RESTPostAPIApplicationCommandsJSONBody[];

      console.log(
        chalk.green(
          `Successfully reloaded ${guildData.length} guild application (/) commands.`,
        ),
      );
      guildData.forEach((command) =>
        console.log(chalk.blue(`- ${command.name}`)),
      );
    }
  } catch (error) {
    console.error(chalk.red('Error deploying commands:'), error);
  }
}

deployCommands();
