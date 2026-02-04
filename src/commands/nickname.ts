import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { colors, createEmbed } from '@/utils/embeds.js';
import { requireGuild, isAdmin } from '@/utils/guards.js';
import {
  addNickname,
  removeNickname,
  getUserNicknames,
  getGuildNicknames,
  nicknameExists,
  getNicknameOwner,
  setNicknameAnnounce,
  toggleUserNicknameAnnounce,
} from '@/services/nickname.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Manage nickname mentions')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a nickname for a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to add a nickname for')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('nicknames')
            .setDescription(
              'The nickname(s) to add (comma-separated for multiple)',
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a nickname')
        .addStringOption((option) =>
          option
            .setName('nickname')
            .setDescription('The nickname to remove')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List nicknames')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('List nicknames for a specific user (optional)'),
        )
        .addBooleanOption((option) =>
          option
            .setName('ephemeral')
            .setDescription('Show only to you (default: false)'),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Toggle nickname announcements')
        .addStringOption((option) =>
          option
            .setName('global')
            .setDescription('Set server-wide announcements (admin only)')
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' },
            ),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireGuild(interaction))) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await handleAdd(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'toggle':
        await handleToggle(interaction);
        break;
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guild) return;

    const focused = interaction.options.getFocused().toLowerCase();
    const member = interaction.member as GuildMember;
    const admin = member.permissions.has(PermissionFlagsBits.Administrator);

    const nicknames = admin
      ? await getGuildNicknames(interaction.guild.id)
      : await getUserNicknames(interaction.guild.id, interaction.user.id);

    const filtered = nicknames
      .filter((n) => n.nickname.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((n) => ({ name: n.nickname, value: n.nickname }));

    await interaction.respond(filtered);
  },
};

async function handleAdd(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const user = interaction.options.getUser('user', true);
  const input = interaction.options.getString('nicknames', true);
  const member = interaction.member as GuildMember;

  // Check permissions: users can only add nicknames for themselves unless admin
  if (user.id !== interaction.user.id && !isAdmin(member)) {
    await interaction.reply({
      content: 'You can only add nicknames for yourself.',
      ephemeral: true,
    });
    return;
  }

  const nicknames = input
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && n.length <= 32);

  if (nicknames.length === 0) {
    await interaction.reply({
      content:
        'No valid nicknames provided. Each nickname must be 1-32 characters.',
      ephemeral: true,
    });
    return;
  }

  const added: string[] = [];
  const skipped: string[] = [];

  for (const nickname of nicknames) {
    const exists = await nicknameExists(interaction.guild!.id, nickname);
    if (exists) {
      skipped.push(nickname);
    } else {
      await addNickname(interaction.guild!.id, user.id, nickname);
      added.push(nickname);
    }
  }

  if (added.length === 0) {
    await interaction.reply({
      content: `All nicknames are already in use: ${skipped.map((n) => `**${n}**`).join(', ')}`,
      ephemeral: true,
    });
    return;
  }

  const embed = createEmbed()
    .setTitle(added.length === 1 ? 'Nickname Added' : 'Nicknames Added')
    .setColor(colors.success)
    .setDescription(
      `Added ${added.map((n) => `**${n}**`).join(', ')} for ${user}.`,
    );

  if (skipped.length > 0) {
    embed.addFields({
      name: 'Skipped (already in use)',
      value: skipped.map((n) => `**${n}**`).join(', '),
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const nickname = interaction.options.getString('nickname', true).trim();
  const member = interaction.member as GuildMember;

  // Check who owns this nickname
  const ownerId = await getNicknameOwner(interaction.guild!.id, nickname);

  if (!ownerId) {
    await interaction.reply({
      content: `No nickname **${nickname}** found.`,
      ephemeral: true,
    });
    return;
  }

  // Check permissions: users can only remove their own nicknames unless admin
  if (ownerId !== interaction.user.id && !isAdmin(member)) {
    await interaction.reply({
      content: 'You can only remove your own nicknames.',
      ephemeral: true,
    });
    return;
  }

  await removeNickname(interaction.guild!.id, nickname);

  const embed = createEmbed()
    .setTitle('Nickname Removed')
    .setColor(colors.success)
    .setDescription(`Removed nickname **${nickname}** from <@${ownerId}>.`);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const user = interaction.options.getUser('user');
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;

  if (user) {
    const nicknames = await getUserNicknames(interaction.guild!.id, user.id);

    if (nicknames.length === 0) {
      await interaction.reply({
        content: `${user} has no nicknames.`,
        ephemeral: true,
      });
      return;
    }

    const embed = createEmbed()
      .setTitle(`Nicknames for ${user.username}`)
      .setDescription(nicknames.map((n) => `- ${n.nickname}`).join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral });
  } else {
    const nicknames = await getGuildNicknames(interaction.guild!.id);

    if (nicknames.length === 0) {
      await interaction.reply({
        content: 'No nicknames have been added yet.',
        ephemeral: true,
      });
      return;
    }

    // Group by user
    const byUser = new Map<string, string[]>();
    for (const nick of nicknames) {
      const list = byUser.get(nick.userId) ?? [];
      list.push(nick.nickname);
      byUser.set(nick.userId, list);
    }

    const lines: string[] = [];
    for (const [userId, nicks] of byUser) {
      lines.push(`<@${userId}>: ${nicks.join(', ')}`);
    }

    const embed = createEmbed()
      .setTitle('Server Nicknames')
      .setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral });
  }
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const globalState = interaction.options.getString('global');

  // Global toggle (admin only)
  if (globalState) {
    if (!isAdmin(member)) {
      await interaction.reply({
        content: 'Only administrators can toggle global announcements.',
        ephemeral: true,
      });
      return;
    }

    const enabled = globalState === 'on';
    await setNicknameAnnounce(interaction.guild!.id, enabled);

    const embed = createEmbed()
      .setColor(colors.success)
      .setDescription(
        `Global nickname announcements have been turned **${enabled ? 'on' : 'off'}**.`,
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Personal toggle
  const newState = await toggleUserNicknameAnnounce(
    interaction.user.id,
    interaction.user.username,
  );

  const embed = createEmbed()
    .setColor(colors.success)
    .setDescription(
      `Your nickname announcements have been turned **${newState ? 'on' : 'off'}**.`,
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
