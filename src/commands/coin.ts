import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '@/types.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('coin')
    .setDescription('Flips a coin'),
  global: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    await interaction.reply(`The coin landed on **${result}**!`);
  },
};
