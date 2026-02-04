import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { createEmbed } from '@/utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Get a user's avatar")
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to get the avatar of')
        .setRequired(true),
    ) as SlashCommandBuilder,
  global: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);

    const embed = createEmbed()
      .setTitle(`${user.displayName}'s Avatar`)
      .setDescription(`**${user.tag}** (${user.id})`)
      .setImage(user.displayAvatarURL({ size: 256 }));

    await interaction.reply({ embeds: [embed] });
  },
};
