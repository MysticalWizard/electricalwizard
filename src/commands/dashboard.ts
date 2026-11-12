import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { config } from '#/config.js';
import type { SlashCommand } from '#/types.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Get the link to the web dashboard'),
  async execute(interaction: ChatInputCommandInteraction) {
    const button = new ButtonBuilder()
      .setLabel('Open Dashboard')
      .setStyle(ButtonStyle.Link)
      .setURL(config.webBaseUrl);

    await interaction.reply({
      content: config.webBaseUrl,
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
