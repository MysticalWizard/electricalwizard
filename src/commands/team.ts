import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('team scrambler - requested by eddie')
    .addStringOption((option) =>
      option
        .setName('players')
        .setDescription('comma separated list of players.')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('teams')
        .setDescription('number of teams to create.')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(8),
    ) as SlashCommandBuilder,
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const playersOption = interaction.options.getString('players');
    const teamsCountOption = interaction.options.getInteger('teams');

    if (!playersOption || !teamsCountOption) {
      await interaction.editReply('Invalid options provided.');
      return;
    }

    const players = playersOption.split(',').map((player) => player.trim());
    const teamsCount = teamsCountOption;

    // Fisher-Yates Shuffle
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }

    // Distribute players into teams
    const teams: string[][] = Array.from({ length: teamsCount }, () => []);
    players.forEach((player, index) => {
      teams[index % teamsCount].push(player);
    });

    // Generate the reply message
    const reply = teams
      .map((team, index) => `Team ${index + 1}: ${team.join(', ')}`)
      .join('\n');
    await interaction.editReply(reply);
  },
};

export default command;
