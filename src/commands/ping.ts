import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Pong!'),
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    // Calculate the latency between when the command message was received and when the reply message was sent
    const clientLatency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(':ping_pong: Pong!')
      .setDescription(
        `Latency is ${clientLatency}ms. API Latency is ${apiLatency}ms.`,
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
