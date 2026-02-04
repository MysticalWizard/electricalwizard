import {
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { colors, createEmbed } from '@/utils/embeds.js';
import { parseTimeInput, formatDateInTimezone } from '@/utils/parseTime.js';
import {
  getSupportedTimezones,
  validateTimezone,
  resolveTimezone,
} from '@/utils/timezone.js';
import { truncate } from '@/utils/formatName.js';
import { requireGuild } from '@/utils/guards.js';
import { respondTimezoneAutocomplete } from '@/utils/autocomplete.js';
import {
  createDDay,
  getUserDDays,
  deleteDDay,
  updateDDayReminder,
  getDDaysForAutocomplete,
  calculateDaysUntil,
  formatDDayDisplay,
} from '@/services/dday.js';
import type { ReminderFrequency } from '@/models/DDay.js';

const allTimezones = getSupportedTimezones();

const REMIND_CHOICES = [
  { name: 'Every Day', value: 'everyday' },
  { name: 'Every Week', value: 'everyweek' },
  { name: 'Every Month', value: 'everymonth' },
  { name: 'Every Year', value: 'everyyear' },
] as const;

const FREQUENCY_CHOICES = [
  { name: 'Disable', value: 'disable' },
  { name: 'Every Day', value: 'everyday' },
  { name: 'Every Week', value: 'everyweek' },
  { name: 'Every Month', value: 'everymonth' },
  { name: 'Every Year', value: 'everyyear' },
] as const;

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('dday')
    .setDescription('Manage D-Day countdown reminders')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('new')
        .setDescription('Create a new D-Day countdown')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('Title of the D-Day')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('date')
            .setDescription(
              'Target date and optional time (e.g., 2022-11-13, 2022-11-13 14:30)',
            )
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('recurring')
            .setDescription('Reset to next year after D-Day passes'),
        )
        .addBooleanOption((option) =>
          option
            .setName('private')
            .setDescription('Send reminders as DM instead of in channel'),
        )
        .addStringOption((option) =>
          option
            .setName('remind')
            .setDescription('Reminder frequency')
            .addChoices(...REMIND_CHOICES),
        )
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription(
              'Timezone for the date (defaults to your saved timezone)',
            )
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List your D-Day countdowns'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a D-Day countdown')
        .addStringOption((option) =>
          option
            .setName('dday')
            .setDescription('The D-Day to delete')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remind')
        .setDescription('Update reminder frequency for a D-Day')
        .addStringOption((option) =>
          option
            .setName('dday')
            .setDescription('The D-Day to update')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName('frequency')
            .setDescription('New reminder frequency')
            .setRequired(true)
            .addChoices(...FREQUENCY_CHOICES),
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
      case 'delete':
        await handleDelete(interaction);
        break;
      case 'remind':
        await handleRemind(interaction);
        break;
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guild) return;

    const focused = interaction.options.getFocused(true);

    if (focused.name === 'timezone') {
      await respondTimezoneAutocomplete(
        interaction,
        allTimezones,
        allTimezones.slice(0, 25),
      );
    } else if (focused.name === 'dday') {
      await handleDDayAutocomplete(interaction, focused.value);
    }
  },
};

async function handleNew(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const title = interaction.options.getString('title', true);
  const dateInput = interaction.options.getString('date', true);
  const recurring = interaction.options.getBoolean('recurring') ?? false;
  const isPrivate = interaction.options.getBoolean('private') ?? false;
  const remindValue = interaction.options.getString(
    'remind',
  ) as ReminderFrequency | null;
  const timezoneInput = interaction.options.getString('timezone');

  const timezone = await resolveTimezone(interaction.user.id, timezoneInput);
  if (!(await validateTimezone(interaction, timezone))) return;

  // Parse the date input
  const parsed = parseTimeInput(dateInput, timezone);
  if (!parsed) {
    await interaction.reply({
      content:
        'Invalid date format. Examples:\n' +
        '- `2022-11-13`\n' +
        '- `2022-11-13 14:30`\n' +
        '- `11/13/2022`',
      ephemeral: true,
    });
    return;
  }

  // For D-Day, set time to 00:00 (start of day) unless time was specified
  const targetDate = new Date(parsed.date);
  if (!dateInput.includes(':')) {
    targetDate.setHours(0, 0, 0, 0);
  }

  // Create the D-Day
  const dday = await createDDay({
    guildId: interaction.guild!.id,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    title,
    targetDate,
    ...(timezone && { timezone }),
    recurring,
    private: isPrivate,
    reminderFrequency: remindValue,
  });

  const days = calculateDaysUntil(targetDate);
  const displayStr = formatDDayDisplay(days);
  const timestamp = Math.floor(targetDate.getTime() / 1000);

  const embed = createEmbed()
    .setTitle('D-Day Created')
    .setColor(colors.success)
    .setDescription(`**${displayStr}** - ${title}`)
    .addFields(
      { name: 'Target Date', value: `<t:${timestamp}:D>`, inline: true },
      { name: 'Countdown', value: `<t:${timestamp}:R>`, inline: true },
      { name: 'Recurring', value: recurring ? 'Yes' : 'No', inline: true },
      {
        name: 'Private',
        value: isPrivate ? 'Yes (DM)' : 'No (Channel)',
        inline: true,
      },
      {
        name: 'Reminders',
        value: remindValue
          ? (REMIND_CHOICES.find((c) => c.value === remindValue)?.name ??
            'None')
          : 'None',
        inline: true,
      },
    )
    .setFooter({ text: `ID: ${dday._id}` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const ddays = await getUserDDays(interaction.guild!.id, interaction.user.id);

  if (ddays.length === 0) {
    await interaction.reply({
      content: 'You have no D-Day countdowns.',
      ephemeral: true,
    });
    return;
  }

  const embed = createEmbed()
    .setTitle('Your D-Day Countdowns')
    .setDescription(
      ddays
        .map((d, i) => {
          const days = calculateDaysUntil(d.targetDate);
          const displayStr = formatDDayDisplay(days);
          const formattedTime = formatDateInTimezone(d.targetDate, d.timezone);
          const privateTag = d.private ? ' (DM)' : '';
          const recurringTag = d.recurring ? ' (Recurring)' : '';
          const completedTag = d.completed ? ' (Completed)' : '';
          return `**${i + 1}. ${displayStr}** - ${d.title}${privateTag}${recurringTag}${completedTag}\n   Target: ${formattedTime}\n   ID: \`${d._id}\``;
        })
        .join('\n\n'),
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDelete(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const ddayId = interaction.options.getString('dday', true);

  const deleted = await deleteDDay(ddayId, interaction.user.id);

  if (!deleted) {
    await interaction.reply({
      content: 'D-Day not found or you do not have permission to delete it.',
      ephemeral: true,
    });
    return;
  }

  const embed = createEmbed()
    .setTitle('D-Day Deleted')
    .setColor(colors.success)
    .setDescription('Your D-Day countdown has been deleted.');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRemind(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const ddayId = interaction.options.getString('dday', true);
  const frequencyValue = interaction.options.getString('frequency', true);

  const frequency: ReminderFrequency =
    frequencyValue === 'disable' ? null : (frequencyValue as ReminderFrequency);

  const updated = await updateDDayReminder(
    ddayId,
    interaction.user.id,
    frequency,
  );

  if (!updated) {
    await interaction.reply({
      content: 'D-Day not found or you do not have permission to update it.',
      ephemeral: true,
    });
    return;
  }

  const frequencyDisplay = frequency
    ? (REMIND_CHOICES.find((c) => c.value === frequency)?.name ?? 'Unknown')
    : 'Disabled';

  const embed = createEmbed()
    .setTitle('Reminder Updated')
    .setColor(colors.success)
    .setDescription(
      `**${updated.title}**\nReminder frequency: ${frequencyDisplay}`,
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDDayAutocomplete(
  interaction: AutocompleteInteraction,
  value: string,
): Promise<void> {
  const ddays = await getDDaysForAutocomplete(
    interaction.guild!.id,
    interaction.user.id,
    value || undefined,
  );

  await interaction.respond(
    ddays.map((d) => {
      const days = calculateDaysUntil(d.targetDate);
      const displayStr = formatDDayDisplay(days);
      const completedTag = d.completed ? ' (Completed)' : '';
      const label = `${displayStr} - ${truncate(d.title, 60)}${completedTag}`;
      return {
        name: label.slice(0, 100),
        value: d.id,
      };
    }),
  );
}
