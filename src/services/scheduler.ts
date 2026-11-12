import type { Client, EmbedBuilder } from 'discord.js';
import type { IReminder } from '#/models/Reminder.js';
import type { IDDay } from '#/models/DDay.js';
import {
  getDueReminders,
  recordReminderDeliveries,
} from '#/services/reminder.js';
import {
  getDueDDayNotifications,
  recordDDayCompletions,
  recordDDayNotifications,
  processCompletedDDays,
  calculateDaysUntil,
  formatDDayDisplay,
} from '#/services/dday.js';
import { colors, createEmbed } from '#/utils/embeds.js';
import {
  clip,
  EMBED_DESCRIPTION_MAX_LENGTH,
  EMBED_TITLE_MAX_LENGTH,
} from '#/utils/messageLimit.js';

const CHECK_INTERVAL = 30_000; // 30 seconds
// A failed delivery is retried this often, and given up after this many tries
const RETRY_DELAY_MS = 5 * 60_000;
const MAX_DELIVERY_ATTEMPTS = 3;

let intervalId: ReturnType<typeof setInterval> | null = null;
// A tick can outlast the interval when Discord is slow
let running = false;

/** The fields that decide where a reminder or D-Day notification goes. */
interface Recipient {
  guildId: string;
  channelId: string;
  userId: string;
  private: boolean;
  deliveryAttempts?: number | undefined;
}

// These records can be edited from the dashboard, so delivery is held to the
// record's guild: the channel must belong to it, a DM recipient must be a
// member of it, and the owner is the only mention allowed.

async function sendDM(
  client: Client,
  record: Recipient,
  embed: EmbedBuilder,
): Promise<void> {
  const guild = await client.guilds.fetch(record.guildId);
  const member = await guild.members.fetch(record.userId);
  await member.send({ embeds: [embed] });
}

async function sendToChannel(
  client: Client,
  record: Recipient,
  message: { content?: string; embeds?: EmbedBuilder[] },
): Promise<void> {
  const channel = await client.channels.fetch(record.channelId);
  if (
    !channel?.isSendable() ||
    channel.isDMBased() ||
    channel.guildId !== record.guildId
  ) {
    throw new Error(
      `Channel ${record.channelId} is not a text channel in guild ${record.guildId}`,
    );
  }
  await channel.send({
    ...message,
    content: `<@${record.userId}>${message.content ? ` ${message.content}` : ''}`,
    allowedMentions: { users: [record.userId] },
  });
}

/**
 * Send an embed to the owner of a reminder or D-Day: as a DM when it's
 * private, otherwise in its channel with a ping. If the channel can't be
 * used, the owner gets it by DM instead. A private one is never posted in the
 * channel; on its first failure the owner is asked there to open their DMs.
 * Throws if the embed couldn't be delivered.
 */
async function deliver(
  client: Client,
  record: Recipient,
  embed: EmbedBuilder,
): Promise<void> {
  if (record.private) {
    try {
      await sendDM(client, record, embed);
    } catch (error) {
      if (!record.deliveryAttempts) {
        await sendToChannel(client, record, {
          content:
            "I couldn't send you a private reminder by DM. Allow direct messages from this server's members and I'll try again shortly.",
        }).catch(() => {});
      }
      throw error;
    }
    return;
  }

  try {
    await sendToChannel(client, record, { embeds: [embed] });
  } catch (error) {
    console.error(
      `Couldn't post in channel ${record.channelId}, sending by DM instead:`,
      error,
    );
    await sendDM(client, record, embed);
  }
}

/** When a delivery that failed now should be tried again. */
function nextRetry(): Date {
  return new Date(Date.now() + RETRY_DELAY_MS);
}

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
  if (running) return;
  running = true;
  try {
    // Process regular reminders
    const reminders = await getDueReminders();
    const sent: IReminder[] = [];
    const failed: IReminder[] = [];

    for (const reminder of reminders) {
      try {
        const embed = createEmbed()
          .setTitle('Reminder')
          .setColor(colors.primary)
          .setDescription(clip(reminder.message, EMBED_DESCRIPTION_MAX_LENGTH))
          .setTimestamp(reminder.createdAt)
          .setFooter({ text: 'Reminder set' });

        await deliver(client, reminder, embed);
        sent.push(reminder);
      } catch (error) {
        console.error(`Failed to send reminder ${reminder._id}:`, error);
        failed.push(reminder);
      }
    }

    const dropped = await recordReminderDeliveries(
      sent,
      failed,
      MAX_DELIVERY_ATTEMPTS,
      nextRetry(),
    );
    for (const reminder of dropped) {
      console.error(
        `Gave up on reminder ${reminder._id} after ${MAX_DELIVERY_ATTEMPTS} attempts`,
      );
    }

    // Process D-Day notifications
    await checkAndSendDDayNotifications(client);
  } catch (error) {
    console.error('Error checking reminders:', error);
  } finally {
    running = false;
  }
}

/**
 * Check for due D-Day notifications and send them
 */
async function checkAndSendDDayNotifications(client: Client): Promise<void> {
  try {
    // Send due D-Day notifications
    const ddays = await getDueDDayNotifications();
    const notified: IDDay[] = [];
    const notifyFailed: IDDay[] = [];

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
          .setTitle(
            clip(`${displayStr} - ${dday.title}`, EMBED_TITLE_MAX_LENGTH),
          )
          .setColor(days === 0 ? colors.success : colors.primary)
          .setDescription(description)
          .addFields(
            { name: 'Target Date', value: `<t:${timestamp}:D>`, inline: true },
            { name: 'Countdown', value: `<t:${timestamp}:R>`, inline: true },
          );

        await deliver(client, dday, embed);
        notified.push(dday);
      } catch (error) {
        console.error(`Failed to send D-Day notification ${dday._id}:`, error);
        notifyFailed.push(dday);
      }
    }

    // Written before looking for completed D-Days, so one whose notification
    // failed waits for its retry
    await recordDDayNotifications(
      notified,
      notifyFailed,
      MAX_DELIVERY_ATTEMPTS,
      nextRetry(),
    );

    // Process completed D-Days and send completion notifications
    const completedDDays = await processCompletedDDays();
    const completionSent: IDDay[] = [];
    const completionFailed: IDDay[] = [];

    for (const dday of completedDDays) {
      try {
        const embed = createEmbed()
          .setTitle('D-Day Complete!')
          .setColor(colors.warning)
          .setDescription(
            `**${clip(dday.title, EMBED_TITLE_MAX_LENGTH)}** has passed.\n\nWould you like to delete this countdown?\nUse \`/dday delete\` to remove it.`,
          );

        await deliver(client, dday, embed);
        completionSent.push(dday);
      } catch (error) {
        console.error(
          `Failed to send D-Day completion notification ${dday._id}:`,
          error,
        );
        completionFailed.push(dday);
      }
    }

    await recordDDayCompletions(
      completionSent,
      completionFailed,
      MAX_DELIVERY_ATTEMPTS,
      nextRetry(),
    );
  } catch (error) {
    console.error('Error checking D-Day notifications:', error);
  }
}
