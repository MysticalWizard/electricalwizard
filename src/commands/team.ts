import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '@/types.js';

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Generate randomized teams')
    .addStringOption((option) =>
      option
        .setName('players')
        .setDescription('Comma-separated list of players')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('teams')
        .setDescription('Number of teams (2-16)')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(16),
    ) as SlashCommandBuilder,
  global: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const playersInput = interaction.options.getString('players', true);
    const teamCount = interaction.options.getInteger('teams', true);

    const players = playersInput
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (players.length < teamCount) {
      await interaction.reply({
        content: `Not enough players (${players.length}) for ${teamCount} teams.`,
        ephemeral: true,
      });
      return;
    }

    const shuffled = shuffle(players);
    const teams: string[][] = Array.from({ length: teamCount }, () => []);

    shuffled.forEach((player, index) => {
      teams[index % teamCount]!.push(player);
    });

    const result = teams
      .map((team, i) => `**Team ${i + 1}:** ${team.join(', ')}`)
      .join('\n');

    await interaction.reply(result);
  },
};
