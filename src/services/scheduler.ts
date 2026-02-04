import type { Client, TextChannel } from 'discord.js';
import { getDueReminders } from '@/services/reminder.js';
import {
  getDueDDayNotifications,
  processCompletedDDays,
  calculateDaysUntil,
  formatDDayDisplay,
} from '@/services/dday.js';
import { colors, createEmbed } from '@/utils/embeds.js';

const CHECK_INTERVAL = 30_000; // 30 seconds

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the reminder scheduler
 */
export function startReminderScheduler(client: Client): void {
  if (intervalId) {
    console.log('Reminder scheduler already running');
    return;
  }

  console.log('Starting reminder scheduler');

  // Run immediately on start
  void checkAndSendReminders(client);

  // Then run on interval
  intervalId = setInterval(() => {
    void checkAndSendReminders(client);
  }, CHECK_INTERVAL);
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Reminder scheduler stopped');
  }
}

/**
 * Check for due reminders and send them
 */
async function checkAndSendReminders(client: Client): Promise<void> {
  try {
    // Process regular reminders
    const reminders = await getDueReminders();

    for (const reminder of reminders) {
      try {
        const embed = createEmbed()
          .setTitle('Reminder')
          .setColor(colors.primary)
          .setDescription(reminder.message)
          .setTimestamp(reminder.createdAt)
          .setFooter({ text: 'Reminder set' });

        if (reminder.private) {
          // Send as DM
          const user = await client.users.fetch(reminder.userId);
          await user.send({ embeds: [embed] });
        } else {
          // Send in channel
          const channel = await client.channels.fetch(reminder.channelId);
          if (channel?.isTextBased()) {
            await (channel as TextChannel).send({
              content: `<@${reminder.userId}>`,
              embeds: [embed],
            });
          }
        }
      } catch (error) {
        console.error(`Failed to send reminder ${reminder._id}:`, error);
      }
    }

    // Process D-Day notifications
    await checkAndSendDDayNotifications(client);
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}

/**
 * Check for due D-Day notifications and send them
 */
async function checkAndSendDDayNotifications(client: Client): Promise<void> {
  try {
    // Send due D-Day notifications
    const ddays = await getDueDDayNotifications();

    for (const dday of ddays) {
      try {
        const days = calculateDaysUntil(dday.targetDate);
        const displayStr = formatDDayDisplay(days);
        const timestamp = Math.floor(dday.targetDate.getTime() / 1000);

        let description: string;
        if (days === 0) {
          description = 'Today is the day!';
        } else if (days > 0) {
          description = `${days} day${days === 1 ? '' : 's'} remaining`;
        } else {
          description = `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
        }

        const embed = createEmbed()
          .setTitle(`${displayStr} - ${dday.title}`)
          .setColor(days === 0 ? colors.success : colors.primary)
          .setDescription(description)
          .addFields(
            { name: 'Target Date', value: `<t:${timestamp}:D>`, inline: true },
            { name: 'Countdown', value: `<t:${timestamp}:R>`, inline: true },
          );

        if (dday.private) {
          // Send as DM
          const user = await client.users.fetch(dday.userId);
          await user.send({ embeds: [embed] });
        } else {
          // Send in channel
          const channel = await client.channels.fetch(dday.channelId);
          if (channel?.isTextBased()) {
            await (channel as TextChannel).send({
              content: `<@${dday.userId}>`,
              embeds: [embed],
            });
          }
        }
      } catch (error) {
        console.error(`Failed to send D-Day notification ${dday._id}:`, error);
      }
    }

    // Process completed D-Days and send completion notifications
    const completedDDays = await processCompletedDDays();

    for (const dday of completedDDays) {
      try {
        const embed = createEmbed()
          .setTitle('D-Day Complete!')
          .setColor(colors.warning)
          .setDescription(
            `**${dday.title}** has passed.\n\nWould you like to delete this countdown?\nUse \`/dday delete\` to remove it.`,
          );

        if (dday.private) {
          const user = await client.users.fetch(dday.userId);
          await user.send({ embeds: [embed] });
        } else {
          const channel = await client.channels.fetch(dday.channelId);
          if (channel?.isTextBased()) {
            await (channel as TextChannel).send({
              content: `<@${dday.userId}>`,
              embeds: [embed],
            });
          }
        }
      } catch (error) {
        console.error(
          `Failed to send D-Day completion notification ${dday._id}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error('Error checking D-Day notifications:', error);
  }
}
