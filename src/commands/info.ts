import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder().setName('info').setDescription('Bot info.'),
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.reply(`ElectricalWizard Discord Bot (v3.0.0)`);
  },
};

export default command;
