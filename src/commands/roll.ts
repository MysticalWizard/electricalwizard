import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a random number.')
    .addIntegerOption((option) =>
      option
        .setName('n')
        .setDescription('Maximum number to roll. Default is 100.')
        .setMinValue(1)
        .setMaxValue(1000000),
    ) as SlashCommandBuilder,
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.user;
    const max = interaction.options.getInteger('n') || 100;
    const roll = Math.floor(Math.random() * max) + 1;
    await interaction.reply(`${user} rolled ${roll}.`);
  },
};

export default command;
