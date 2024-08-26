import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import UserModel from '@/models/User.js';
import { SlashCommand } from '@/types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const timezoneChoices = Array.from({ length: 25 }, (_, i) => {
  const offset = i - 12;
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const label = `UTC${sign}${absOffset.toString().padStart(2, '0')}:00`;
  return { name: label, value: offset.toString() };
});

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('bday')
    .setDescription('Set your birthday')
    .addIntegerOption((option) =>
      option
        .setName('year')
        .setDescription('Your birth year')
        .setMinValue(1901)
        .setMaxValue(new Date().getFullYear())
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('month')
        .setDescription('Your birth month (1-12)')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('day')
        .setDescription('Your birth day (1-31)')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('timezone')
        .setDescription('Timezone for birthday celebration')
        .setRequired(true)
        .addChoices(...timezoneChoices),
    )
    .addBooleanOption((option) =>
      option
        .setName('announce')
        .setDescription('Announce your birthday in chat?')
        .setRequired(true),
    ) as SlashCommandBuilder,
  global: true,
  cooldown: 10, // in seconds

  execute: async (interaction: ChatInputCommandInteraction) => {
    const year = interaction.options.getInteger('year', true);
    const monthInput = interaction.options.getString('month', true);
    const dayInput = interaction.options.getString('day', true);
    const timezoneOffset = parseInt(
      interaction.options.getString('timezone', true),
    );
    const announce = interaction.options.getBoolean('announce', true);

    // Parse month and day, removing leading zeros
    const month = parseInt(monthInput, 10);
    const day = parseInt(dayInput, 10);

    // Validate month and day
    if (isNaN(month) || month < 1 || month > 12) {
      await interaction.reply({
        content: 'Invalid month. Please enter a number between 1 and 12.',
        ephemeral: true,
      });
      return;
    }

    if (isNaN(day) || day < 1 || day > 31) {
      await interaction.reply({
        content: 'Invalid day. Please enter a number between 1 and 31.',
        ephemeral: true,
      });
      return;
    }

    // Validate date
    const date = dayjs(`${year}-${month}-${day}`, 'YYYY-M-D', true);
    if (!date.isValid()) {
      await interaction.reply({
        content: 'Invalid date. Please check your input.',
        ephemeral: true,
      });
      return;
    }

    // Check for leap year if February 29th
    if (month === 2 && day === 29 && !dayjs(`${year}-02-29`).isValid()) {
      await interaction.reply({
        content: 'Invalid date. February 29th only exists in leap years.',
        ephemeral: true,
      });
      return;
    }

    // Check for 31st day in months with 30 days
    if (day === 31 && [4, 6, 9, 11].includes(month)) {
      await interaction.reply({
        content: 'Invalid date. This month only has 30 days.',
        ephemeral: true,
      });
      return;
    }

    try {
      await UserModel.findOneAndUpdate(
        { userId: interaction.user.id },
        {
          $set: {
            birthday: date.toDate(),
            birthdayTimezone: timezoneOffset,
            username: interaction.user.username,
          },
        },
        { upsert: true, new: true },
      );

      const timezoneString = `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}:00`;
      await interaction.reply({
        content: `Your birthday has been set to ${date.format('MMMM D, YYYY')} in timezone ${timezoneString}.`,
        ephemeral: true,
      });

      if (announce) {
        await sendBirthdayMessage(
          interaction,
          interaction.user.id,
          date,
          timezoneOffset,
        );
      }
    } catch (error) {
      console.error('Error setting birthday:', error);
      await interaction.followUp({
        content:
          'There was an error setting your birthday. Please try again later.',
        ephemeral: true,
      });
    }
  },
};

async function sendBirthdayMessage(
  interaction: ChatInputCommandInteraction,
  userId: string,
  birthday: dayjs.Dayjs,
  timezoneOffset: number,
) {
  const user = interaction.user;

  // Send DM
  try {
    const timezoneString = `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}:00`;
    const userTimezone = dayjs().utcOffset(timezoneOffset * 60);
    const isBirthdayToday =
      userTimezone.month() === birthday.month() &&
      userTimezone.date() === birthday.date();

    if (isBirthdayToday) {
      const todayFormatted = userTimezone.format('MMMM D');
      await user.send(
        `Happy birthday! 🎉 Your birthday (${todayFormatted}) has been registered in timezone ${timezoneString}.`,
      );
    } else {
      await user.send(
        `Your birthday (${birthday.format('MMMM D')}) has been registered in timezone ${timezoneString}.`,
      );
    }
  } catch (error) {
    console.error('Error sending DM:', error);
  }
}

export default command;
