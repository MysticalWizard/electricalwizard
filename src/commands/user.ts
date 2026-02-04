import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { colors, createEmbed } from '@/utils/embeds.js';
import { getSupportedTimezones, validateTimezone } from '@/utils/timezone.js';
import { formatFullName } from '@/utils/formatName.js';
import { requireGuild } from '@/utils/guards.js';
import { respondTimezoneAutocomplete } from '@/utils/autocomplete.js';
import { User } from '@/models/User.js';

const timezones = getSupportedTimezones();

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Manage user details')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set user details')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to update')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('first_name').setDescription("User's first name"),
        )
        .addStringOption((option) =>
          option.setName('last_name').setDescription("User's last name"),
        )
        .addStringOption((option) =>
          option
            .setName('birthday')
            .setDescription('Birthday in YYYY-MM-DD format'),
        )
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('IANA timezone (e.g., America/New_York)')
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('get')
        .setDescription('Get user details')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to view')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List all users in the database'),
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
      case 'list':
        await handleList(interaction);
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
  const user = interaction.options.getUser('user', true);
  const firstName = interaction.options.getString('first_name');
  const lastName = interaction.options.getString('last_name');
  const birthdayStr = interaction.options.getString('birthday');
  const timezone = interaction.options.getString('timezone');

  const update: Record<string, unknown> = {};

  if (firstName !== null) update['name.first'] = firstName || undefined;
  if (lastName !== null) update['name.last'] = lastName || undefined;

  if (birthdayStr !== null) {
    if (birthdayStr === '') {
      update.birthday = undefined;
    } else {
      const birthday = new Date(birthdayStr);
      if (isNaN(birthday.getTime())) {
        await interaction.reply({
          content: 'Invalid date format. Use YYYY-MM-DD.',
          ephemeral: true,
        });
        return;
      }
      update.birthday = birthday;
    }
  }

  if (timezone !== null) {
    if (timezone === '') {
      update.timezone = undefined;
    } else {
      if (!(await validateTimezone(interaction, timezone))) return;
      update.timezone = timezone;
    }
  }

  if (Object.keys(update).length === 0) {
    const existing = await User.findOneAndUpdate(
      { discordId: user.id },
      { $setOnInsert: { isBot: user.bot }, username: user.username },
      { upsert: true },
    );

    await interaction.reply({
      content: `${user} ${existing ? 'updated' : 'added to database'}.`,
      ephemeral: true,
    });
    return;
  }

  const updatedUser = await User.findOneAndUpdate(
    { discordId: user.id },
    { $set: { ...update, isBot: user.bot }, username: user.username },
    { new: true, upsert: true },
  );

  const embed = createEmbed()
    .setTitle('User Updated')
    .setColor(colors.success)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${user}`, inline: true },
      {
        name: 'Name',
        value: formatFullName(
          updatedUser.name?.first,
          updatedUser.name?.last,
          'Not set',
        ),
        inline: true,
      },
      {
        name: 'Birthday',
        value: updatedUser.birthday?.toISOString().split('T')[0] ?? 'Not set',
        inline: true,
      },
      {
        name: 'Timezone',
        value: updatedUser.timezone ?? 'Not set',
        inline: true,
      },
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleGet(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const dbUser = await User.findOne({ discordId: user.id });

  if (!dbUser) {
    await interaction.reply({
      content: `${user} has no data stored.`,
      ephemeral: true,
    });
    return;
  }

  const embed = createEmbed()
    .setTitle('User Details')
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${user}`, inline: true },
      {
        name: 'Name',
        value: formatFullName(dbUser.name?.first, dbUser.name?.last, 'Not set'),
        inline: true,
      },
      {
        name: 'Birthday',
        value: dbUser.birthday?.toISOString().split('T')[0] ?? 'Not set',
        inline: true,
      },
      {
        name: 'Timezone',
        value: dbUser.timezone ?? 'Not set',
        inline: true,
      },
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const members = await interaction.guild!.members.fetch();
  const memberIds = new Set(members.map((m) => m.id));

  const users = await User.find().sort({ createdAt: 1 }).lean();
  const guildUsers = users.filter((u) => memberIds.has(u.discordId));

  if (guildUsers.length === 0) {
    await interaction.editReply('No users in the database for this server.');
    return;
  }

  const lines = guildUsers.map((user) => {
    const name = formatFullName(user.name?.first, user.name?.last, '');
    const botTag = user.isBot ? ' [BOT]' : '';
    return `<@${user.discordId}>${botTag}${name ? ` — ${name}` : ''}`;
  });

  const content = lines.join('\n');

  await interaction.editReply(content);
}
