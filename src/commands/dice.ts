import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '@/types.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Rolls a six-sided dice'),
  global: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const roll = Math.floor(Math.random() * 6) + 1;
    await interaction.reply(`${interaction.user} rolled ${roll}.`);
  },
};
