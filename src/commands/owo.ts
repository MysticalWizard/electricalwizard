import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder().setName('owo').setDescription('owo?'),
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const options = ['owo', 'OwO', 'uwu', 'UwU'];
    const owo = options[Math.floor(Math.random() * options.length)];
    await interaction.reply(owo);
  },
};

export default command;
