import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import tz from 'dayjs/plugin/timezone.js';
import type { SlashCommand } from '@/types.js';
import { colors, createEmbed } from '@/utils/embeds.js';
import { getSupportedTimezones, isValidTimezone } from '@/utils/timezone.js';
import { requireGuild } from '@/utils/guards.js';
import { respondTimezoneAutocomplete } from '@/utils/autocomplete.js';
import { User } from '@/models/User.js';

dayjs.extend(utc);
dayjs.extend(tz);

const timezones = getSupportedTimezones();

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('timezone')
    .setDescription('Manage timezones')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set a timezone (admins can set for others)')
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('IANA timezone (e.g., America/New_York)')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription(
              'User to update (admin only, defaults to yourself)',
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('get')
        .setDescription("Get a user's timezone and current time")
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to check (defaults to yourself)'),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireGuild(interaction))) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'set':
        await handleSet(interaction);
        break;
      case 'get':
        await handleGet(interaction);
        break;
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    await respondTimezoneAutocomplete(interaction, timezones);
  },
};

async function handleSet(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const timezone = interaction.options.getString('timezone', true);
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const isSelf = targetUser.id === interaction.user.id;

  // Check permissions if setting for another user
  if (
    !isSelf &&
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) {
    await interaction.reply({
      content:
        "You need Administrator permission to change other users' timezones.",
      ephemeral: true,
    });
    return;
  }

  if (!isValidTimezone(timezone)) {
    await interaction.reply({
      content: `Invalid timezone: \`${timezone}\`. Use a valid IANA timezone like \`America/New_York\`.`,
      ephemeral: true,
    });
    return;
  }

  await User.findOneAndUpdate(
    { discordId: targetUser.id },
    {
      $set: { timezone, isBot: targetUser.bot },
      username: targetUser.username,
    },
    { upsert: true },
  );

  const currentTime = dayjs().tz(timezone).format('YYYY-MM-DD HH:mm');

  const embed = createEmbed()
    .setTitle('Timezone Updated')
    .setColor(colors.success)
    .setThumbnail(targetUser.displayAvatarURL());

  if (!isSelf) {
    embed.addFields({ name: 'User', value: `${targetUser}`, inline: true });
  }

  embed.addFields(
    { name: 'Timezone', value: timezone, inline: true },
    { name: 'Current Time', value: currentTime, inline: true },
  );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleGet(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const targetUser = interaction.options.getUser('user') ?? interaction.user;

  const dbUser = await User.findOne({ discordId: targetUser.id }).lean();

  if (!dbUser?.timezone) {
    const isSelf = targetUser.id === interaction.user.id;
    await interaction.reply({
      content: isSelf
        ? 'You have not set a timezone. Use `/timezone set` to set one.'
        : `${targetUser} has not set a timezone.`,
      ephemeral: true,
    });
    return;
  }

  const currentTime = dayjs().tz(dbUser.timezone).format('YYYY-MM-DD HH:mm');

  const embed = createEmbed()
    .setTitle('Timezone')
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${targetUser}`, inline: true },
      { name: 'Timezone', value: dbUser.timezone, inline: true },
      { name: 'Current Time', value: currentTime, inline: true },
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
