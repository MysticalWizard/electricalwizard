import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '@/types.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Rolls a random number in a specified range')
    .addIntegerOption((option) =>
      option
        .setName('max')
        .setDescription('Maximum number (default: 100)')
        .setMinValue(1)
        .setMaxValue(1000000),
    ) as SlashCommandBuilder,
  global: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const max = interaction.options.getInteger('max') ?? 100;
    const roll = Math.floor(Math.random() * max) + 1;
    await interaction.reply(`${interaction.user} rolled ${roll}.`);
  },
};
