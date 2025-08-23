import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import ReminderModel from '@/models/Reminder.js';
import { SlashCommand } from '@/types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(relativeTime);

const timezoneChoices = Array.from({ length: 25 }, (_, i) => {
  const offset = i - 12;
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const label = `UTC${sign}${absOffset.toString().padStart(2, '0')}:00`;
  return { name: label, value: offset.toString() };
});

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a personal reminder')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set a new reminder')
        .addStringOption((option) =>
          option
            .setName('time')
            .setDescription(
              'When to remind you (e.g., "2h", "30m", "1d", "2025-12-25 15:30")',
            )
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('What to remind you about')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('Your timezone for the reminder')
            .addChoices(...timezoneChoices),
        )
        .addBooleanOption((option) =>
          option
            .setName('private')
            .setDescription('Send reminder as a DM instead of in the channel')
            .setRequired(false),
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
            .setName('reminder_id')
            .setDescription('ID of the reminder to cancel')
            .setRequired(true),
        ),
    ) as SlashCommandBuilder,
  global: true,
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'set':
        await handleSetReminder(interaction);
        break;
      case 'list':
        await handleListReminders(interaction);
        break;
      case 'cancel':
        await handleCancelReminder(interaction);
        break;
    }
  },
};

async function handleSetReminder(interaction: ChatInputCommandInteraction) {
  const timeInput = interaction.options.getString('time', true);
  const message = interaction.options.getString('message', true);
  const timezoneOffset = parseInt(
    interaction.options.getString('timezone') || '0',
  );
  const isPrivate = interaction.options.getBoolean('private') || false;

  let reminderTime: dayjs.Dayjs;

  try {
    reminderTime = parseTimeInput(timeInput, timezoneOffset);
  } catch {
    await interaction.reply({
      content:
        'Invalid time format. Use formats like "2h", "30m", "1d", or "2025-12-25 15:30".',
      ephemeral: true,
    });
    return;
  }

  if (reminderTime.isBefore(dayjs())) {
    await interaction.reply({
      content: 'Reminder time must be in the future.',
      ephemeral: true,
    });
    return;
  }

  try {
    const reminder = new ReminderModel({
      userId: interaction.user.id,
      message,
      reminderTime: reminderTime.toDate(),
      timezone: timezoneOffset,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      isPrivate,
    });

    await reminder.save();

    const timezoneString = `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}:00`;
    const formattedTime = reminderTime.format('MMMM D, YYYY [at] h:mm A');
    const deliveryMethod = isPrivate ? 'via DM' : 'in this channel';

    await interaction.reply({
      content: `Reminder set! I'll remind you "${message}" on ${formattedTime} (${timezoneString}) ${deliveryMethod}.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error setting reminder:', error);
    await interaction.reply({
      content: 'Failed to set reminder. Please try again.',
      ephemeral: true,
    });
  }
}

async function handleListReminders(interaction: ChatInputCommandInteraction) {
  try {
    const reminders = await ReminderModel.find({
      userId: interaction.user.id,
      isCompleted: false,
      reminderTime: { $gte: new Date() },
    })
      .sort({ reminderTime: 1 })
      .limit(10);

    if (reminders.length === 0) {
      await interaction.reply({
        content: 'You have no active reminders.',
        ephemeral: true,
      });
      return;
    }

    const reminderList = reminders
      .map((reminder) => {
        const time = dayjs(reminder.reminderTime).utcOffset(
          reminder.timezone * 60,
        );
        const timezoneString = `UTC${reminder.timezone >= 0 ? '+' : ''}${reminder.timezone}:00`;
        const deliveryIcon = reminder.isPrivate ? '🔒' : '💬';
        const deliveryText = reminder.isPrivate ? ' (DM)' : ' (Channel)';
        return `**${reminder._id}:** "${reminder.message}"\n📅 ${time.format('MMMM D, YYYY [at] h:mm A')} (${timezoneString}) ${deliveryIcon}${deliveryText}`;
      })
      .join('\n\n');

    await interaction.reply({
      content: `**Your Active Reminders:**\n\n${reminderList}`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error listing reminders:', error);
    await interaction.reply({
      content: 'Failed to retrieve reminders. Please try again.',
      ephemeral: true,
    });
  }
}

async function handleCancelReminder(interaction: ChatInputCommandInteraction) {
  const reminderId = interaction.options.getString('reminder_id', true);

  try {
    const reminder = await ReminderModel.findOneAndUpdate(
      {
        _id: reminderId,
        userId: interaction.user.id,
        isCompleted: false,
      },
      { isCompleted: true },
      { new: true },
    );

    if (!reminder) {
      await interaction.reply({
        content: 'Reminder not found or already completed.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `Reminder "${reminder.message}" has been cancelled.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error cancelling reminder:', error);
    await interaction.reply({
      content: 'Failed to cancel reminder. Please try again.',
      ephemeral: true,
    });
  }
}

function parseTimeInput(
  timeInput: string,
  timezoneOffset: number,
): dayjs.Dayjs {
  const now = dayjs().utcOffset(timezoneOffset * 60);

  // Check for relative time format (e.g., "2h", "30m", "1d")
  const relativeMatch = timeInput.match(/^(\d+)([smhdw])$/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();

    switch (unit) {
      case 's':
        return now.add(amount, 'second');
      case 'm':
        return now.add(amount, 'minute');
      case 'h':
        return now.add(amount, 'hour');
      case 'd':
        return now.add(amount, 'day');
      case 'w':
        return now.add(amount, 'week');
      default:
        throw new Error('Invalid time unit');
    }
  }

  // Check for absolute time format (e.g., "2025-12-25 15:30", "Dec 25 3:30 PM")
  const absoluteTime = dayjs(timeInput).utcOffset(timezoneOffset * 60);
  if (absoluteTime.isValid()) {
    return absoluteTime;
  }

  // Try parsing with different formats
  const formats = [
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD h:mm A',
    'MM-DD HH:mm',
    'MM-DD h:mm A',
    'MMM D HH:mm',
    'MMM D h:mm A',
    'MMMM D HH:mm',
    'MMMM D h:mm A',
  ];

  for (const format of formats) {
    const parsed = dayjs(timeInput, format, true).utcOffset(
      timezoneOffset * 60,
    );
    if (parsed.isValid()) {
      // If no year specified, assume current year
      if (!format.includes('YYYY')) {
        return parsed.year(now.year());
      }
      return parsed;
    }
  }

  throw new Error('Unable to parse time input');
}

export default command;
