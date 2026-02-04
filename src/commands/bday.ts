import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { colors, createEmbed } from '@/utils/embeds.js';
import {
  getBirthday,
  upsertBirthday,
  parseBirthday,
  formatBirthday,
} from '@/services/birthday.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('bday')
    .setDescription('Set or view a birthday')
    .addStringOption((option) =>
      option
        .setName('date')
        .setDescription('Birthday (MM/DD/YYYY) - omit to view'),
    )
    .addUserOption((option) =>
      option.setName('user').setDescription('Target user (admin only to set)'),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const dateInput = interaction.options.getString('date');
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.member as GuildMember;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const isSelf = targetUser.id === interaction.user.id;

    // View mode
    if (!dateInput) {
      const birthday = await getBirthday(targetUser.id);

      if (!birthday) {
        await interaction.reply({
          content: isSelf
            ? "You haven't set your birthday yet."
            : `${targetUser} hasn't set their birthday.`,
          ephemeral: true,
        });
        return;
      }

      const embed = createEmbed().setDescription(
        isSelf
          ? `Your birthday is **${formatBirthday(birthday)}**.`
          : `${targetUser}'s birthday is **${formatBirthday(birthday)}**.`,
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Set mode - check permissions
    if (!isSelf && !isAdmin) {
      await interaction.reply({
        content: 'You can only set your own birthday.',
        ephemeral: true,
      });
      return;
    }

    const parsed = parseBirthday(dateInput);
    if (!parsed) {
      await interaction.reply({
        content: 'Invalid date. Use MM/DD/YYYY format (e.g., 12/25/1990).',
        ephemeral: true,
      });
      return;
    }

    await upsertBirthday(targetUser.id, targetUser.username, parsed);

    const embed = createEmbed()
      .setColor(colors.success)
      .setDescription(
        isSelf
          ? `Your birthday has been set to **${formatBirthday(parsed)}**.`
          : `${targetUser}'s birthday has been set to **${formatBirthday(parsed)}**.`,
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
