import { Collection } from 'discord.js';
import { SlashCommand } from '@/types';

declare module 'discord.js' {
  export interface Client {
    /**
     * A collection of slash commands available the bot.
     *
     * This property extends the Discord.js Client to include a collection
     * of SlashCommand objects, allowing easy access to all registered
     * slash commands throughout the application.
     *
     * The key is the command name, and the value is the SlashCommand object.
     */
    commands: Collection<string, SlashCommand>;
  }
}
