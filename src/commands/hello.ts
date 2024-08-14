import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder().setName('hello').setDescription('Greetings.'),
  global: true,
  execute: async (interaction: CommandInteraction) => {
    await interaction.reply(`Hello, ${interaction.user}!`);
  },
};

export default command;
