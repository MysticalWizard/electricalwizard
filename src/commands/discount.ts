import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('discount')
    .setDescription('LMAO')
    .addIntegerOption((option) =>
      option
        .setName('price')
        .setDescription('the price')
        .setMinValue(1)
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('discount')
        .setDescription('where is my 75%')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true),
    ) as SlashCommandBuilder,
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const price = interaction.options.getInteger('price', true);
    const discount = interaction.options.getInteger('discount', true);
    const discounted = price * (1 - discount / 100);
    await interaction.reply(`${discounted}`);
  },
};

export default command;
