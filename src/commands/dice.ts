import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Rolls one or more six-sided dice.')
    .addIntegerOption((option) =>
      option
        .setName('n')
        .setDescription('How many six-sided dice to roll. (1-6)')
        .setMinValue(1)
        .setMaxValue(6),
    ) as SlashCommandBuilder,
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.user;
    const numberOfDice = interaction.options.getInteger('n') || 1;

    const rolls = Array.from(
      { length: numberOfDice },
      () => Math.floor(Math.random() * 6) + 1,
    );
    const totalRoll = rolls.reduce((sum, roll) => sum + roll, 0);

    let replyMessage = `${user} rolled `;

    if (numberOfDice === 1) {
      replyMessage += `**${rolls[0]}**.`;
    } else {
      const rollsString = rolls.map((roll) => `**${roll}**`).join(', ');
      replyMessage += `${rollsString} for a total of **${totalRoll}**.`;
    }

    await interaction.reply(replyMessage);
  },
};

export default command;
