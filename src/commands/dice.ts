import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Rolls a six-sided die.'),
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.user;
    const roll = Math.floor(Math.random() * 6) + 1;
    await interaction.reply(`${user} rolled **${roll}**.`);
  },
};

export default command;
