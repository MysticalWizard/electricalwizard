import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '@/types.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder().setName('hello').setDescription('Greetings!'),
  global: true,
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(`Hello, ${interaction.user}!`);
  },
};
