import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { colors, createEmbed } from '@/utils/embeds.js';

function getLatencyColor(latency: number): number {
  if (latency < 50) return colors.primary;
  if (latency < 100) return colors.success;
  if (latency < 200) return colors.warning;
  return colors.danger;
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  global: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const apiLatency = Date.now() - interaction.createdTimestamp;
    const clientLatency = interaction.client.ws.ping;
    const maxLatency = Math.max(apiLatency, clientLatency);

    const embed = createEmbed()
      .setTitle(':ping_pong: Pong!')
      .setDescription(
        `Latency is ${clientLatency}ms. API Latency is ${apiLatency}ms.`,
      )
      .setColor(getLatencyColor(maxLatency));

    await interaction.reply({ embeds: [embed] });
  },
};
