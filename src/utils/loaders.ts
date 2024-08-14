import { Client, ClientEvents } from 'discord.js';
import { readdir } from 'fs/promises';
import { dirname, extname, join } from 'path';
import type { Event, SlashCommand } from '@/types';
import { validFileExtension } from '@/utils/helpers.js';

async function loadFiles<T>(dirPath: string): Promise<T[]> {
  const items: T[] = [];

  async function scanDirectory(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.isFile() && extname(entry.name) === validFileExtension) {
        const module = await import(fullPath);
        items.push(module.default || module);
      }
    }
  }

  await scanDirectory(dirPath);
  return items;
}

export async function loadCommands(client: Client): Promise<void> {
  const commandsPath = join(dirname(import.meta.dirname), 'commands');
  const commands = await loadFiles<SlashCommand>(commandsPath);

  for (const command of commands) {
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${JSON.stringify(command)} is missing a required "data" or "execute" property.`,
      );
    }
  }
}

export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = join(dirname(import.meta.dirname), 'events');
  const events = await loadFiles<Event<keyof ClientEvents>>(eventsPath);

  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}
