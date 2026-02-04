import {
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { colors, createEmbed } from '@/utils/embeds.js';
import {
  getSupportedTimezones,
  validateTimezone,
  resolveTimezone,
} from '@/utils/timezone.js';
import { truncate } from '@/utils/formatName.js';
import { requireGuild } from '@/utils/guards.js';
import { respondTimezoneAutocomplete } from '@/utils/autocomplete.js';
import {
  parseTimeInput,
  formatDuration,
  formatDateInTimezone,
} from '@/utils/parseTime.js';
import {
  createReminder,
  getUserReminders,
  cancelReminder,
  getUsedTimezones,
  getRemindersForAutocomplete,
} from '@/services/reminder.js';

const allTimezones = getSupportedTimezones();

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set and manage reminders')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('new')
        .setDescription('Create a new reminder')
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('What to remind you about')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('time')
            .setDescription(
              'When to remind you (e.g., 1h, 30m, 2d, 2026-03-29)',
            )
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription(
              'Timezone for the reminder (defaults to your saved timezone)',
            )
            .setAutocomplete(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('private')
            .setDescription('Send reminder as a DM instead of in channel'),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List your active reminders'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('cancel')
        .setDescription('Cancel a reminder')
        .addStringOption((option) =>
          option
            .setName('reminder')
            .setDescription('The reminder to cancel')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireGuild(interaction))) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'new':
        await handleNew(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'cancel':
        await handleCancel(interaction);
        break;
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guild) return;

    const focused = interaction.options.getFocused(true);

    if (focused.name === 'timezone') {
      const usedTimezones = await getUsedTimezones();
      await respondTimezoneAutocomplete(
        interaction,
        allTimezones,
        usedTimezones,
      );
    } else if (focused.name === 'reminder') {
      await handleReminderAutocomplete(interaction, focused.value);
    }
  },
};

async function handleNew(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const message = interaction.options.getString('message', true);
  const timeInput = interaction.options.getString('time', true);
  const timezoneInput = interaction.options.getString('timezone');
  const isPrivate = interaction.options.getBoolean('private') ?? false;

  const timezone = await resolveTimezone(interaction.user.id, timezoneInput);
  if (!(await validateTimezone(interaction, timezone))) return;

  // Parse the time input
  const parsed = parseTimeInput(timeInput, timezone);
  if (!parsed) {
    await interaction.reply({
      content:
        'Invalid time format. Examples:\n' +
        '- Relative: `1h`, `30m`, `2d`, `1h30m`, `13hr 43m`\n' +
        '- Absolute: `2026-03-29`, `2026-03-29 14:30`',
      ephemeral: true,
    });
    return;
  }

  // Check if the time is in the past
  if (parsed.date <= new Date()) {
    await interaction.reply({
      content: 'The reminder time must be in the future.',
      ephemeral: true,
    });
    return;
  }

  // Create the reminder
  const reminder = await createReminder({
    guildId: interaction.guild!.id,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    message,
    triggerAt: parsed.date,
    ...(timezone && { timezone }),
    private: isPrivate,
  });

  const timestamp = Math.floor(parsed.date.getTime() / 1000);

  const embed = createEmbed()
    .setTitle('Reminder Set')
    .setColor(colors.success)
    .setDescription(`I'll remind you: **${message}**`)
    .addFields(
      { name: 'When', value: `<t:${timestamp}:f>`, inline: true },
      { name: 'In', value: `<t:${timestamp}:R>`, inline: true },
      {
        name: 'Private',
        value: isPrivate ? 'Yes (DM)' : 'No (Channel)',
        inline: true,
      },
    )
    .setFooter({ text: `ID: ${reminder._id}` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const reminders = await getUserReminders(
    interaction.guild!.id,
    interaction.user.id,
  );

  if (reminders.length === 0) {
    await interaction.reply({
      content: 'You have no active reminders.',
      ephemeral: true,
    });
    return;
  }

  const embed = createEmbed()
    .setTitle('Your Reminders')
    .setDescription(
      reminders
        .map((r, i) => {
          const timeUntil = formatDuration(
            new Date(r.triggerAt).getTime() - Date.now(),
          );
          const formattedTime = formatDateInTimezone(r.triggerAt, r.timezone);
          const privateTag = r.private ? ' 🔒' : '';
          return `**${i + 1}.** ${r.message}${privateTag}\n   ⏰ ${formattedTime} (in ${timeUntil})\n   ID: \`${r._id}\``;
        })
        .join('\n\n'),
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCancel(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const reminderId = interaction.options.getString('reminder', true);

  const cancelled = await cancelReminder(reminderId, interaction.user.id);

  if (!cancelled) {
    await interaction.reply({
      content: 'Reminder not found or you do not have permission to cancel it.',
      ephemeral: true,
    });
    return;
  }

  const embed = createEmbed()
    .setTitle('Reminder Cancelled')
    .setColor(colors.success)
    .setDescription('Your reminder has been cancelled.');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleReminderAutocomplete(
  interaction: AutocompleteInteraction,
  value: string,
): Promise<void> {
  const reminders = await getRemindersForAutocomplete(
    interaction.guild!.id,
    interaction.user.id,
    value || undefined,
  );

  await interaction.respond(
    reminders.map((r) => {
      const timeUntil = formatDuration(r.triggerAt.getTime() - Date.now());
      const label = `${truncate(r.message, 50)} (in ${timeUntil})`;
      return {
        name: label.slice(0, 100),
        value: r.id,
      };
    }),
  );
}
