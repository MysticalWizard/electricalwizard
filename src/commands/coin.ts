import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('coin')
    .setDescription('Flips a coin.'),
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    await interaction.reply(`The coin landed on **${result}**!`);
  },
};

export default command;
