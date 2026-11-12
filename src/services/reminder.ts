import { Reminder, type IReminder } from '#/models/Reminder.js';
import { User } from '#/models/User.js';
import { escapeRegex } from '#/utils/regex.js';
import { cacheFor } from '#/utils/cacheFor.js';

export interface CreateReminderData {
  guildId: string;
  channelId: string;
  userId: string;
  message: string;
  triggerAt: Date;
  timezone?: string;
  private?: boolean;
}

/**
 * Create a new reminder
 */
export async function createReminder(
  data: CreateReminderData,
): Promise<IReminder> {
  const reminder = new Reminder({
    guildId: data.guildId,
    channelId: data.channelId,
    userId: data.userId,
    message: data.message,
    triggerAt: data.triggerAt,
    timezone: data.timezone,
    private: data.private ?? false,
  });

  return reminder.save();
}

/**
 * Get all reminders for a user in a guild
 */
export async function getUserReminders(
  guildId: string,
  userId: string,
): Promise<IReminder[]> {
  return Reminder.find({ guildId, userId }).sort({ triggerAt: 1 }).lean();
}

/**
 * Get a specific reminder by ID
 */
export async function getReminderById(
  reminderId: string,
): Promise<IReminder | null> {
  return Reminder.findById(reminderId).lean();
}

/**
 * Cancel (delete) a reminder
 */
export async function cancelReminder(
  reminderId: string,
  userId: string,
): Promise<boolean> {
  const result = await Reminder.deleteOne({
    _id: reminderId,
    userId,
  });
  return result.deletedCount > 0;
}

/**
 * Filter for one reminder. It names the owner as well as the ID so the change
 * feed can tell the owner's dashboard about the write.
 */
function ownFilter(reminder: IReminder) {
  return { _id: reminder._id, userId: reminder.userId };
}

/**
 * Reminders that are due, skipping any waiting to retry a failed delivery.
 * They stay in the database until sent (see markReminderSent), so a failed
 * send or a crash mid-tick doesn't lose them. This assumes a single scheduler
 * instance.
 */
export async function getDueReminders(): Promise<IReminder[]> {
  const now = new Date();
  return Reminder.find({
    triggerAt: { $lte: now },
    retryAt: { $not: { $gt: now } },
  }).lean();
}

/** Remove a reminder once it has been delivered. */
export async function markReminderSent(reminder: IReminder): Promise<void> {
  await Reminder.deleteOne(ownFilter(reminder));
}

/**
 * Record a failed delivery: try again at `retryAt`, or drop the reminder once
 * it has failed `maxAttempts` times. Returns true if it was dropped.
 */
export async function markReminderFailed(
  reminder: IReminder,
  maxAttempts: number,
  retryAt: Date,
): Promise<boolean> {
  const attempts = (reminder.deliveryAttempts ?? 0) + 1;
  if (attempts >= maxAttempts) {
    await Reminder.deleteOne(ownFilter(reminder));
    return true;
  }
  await Reminder.updateOne(ownFilter(reminder), {
    $set: { deliveryAttempts: attempts, retryAt },
  });
  return false;
}

/**
 * Timezones users have set, for autocomplete. Autocomplete runs on every
 * keystroke, so the list is reused for a minute.
 */
export const getUsedTimezones = cacheFor(
  60_000,
  async (): Promise<string[]> => {
    const timezones = await User.distinct('timezone', {
      timezone: { $exists: true, $ne: null },
    });
    return timezones.filter(
      (tz): tz is string => typeof tz === 'string' && tz !== '',
    );
  },
);

/**
 * Get reminders for autocomplete (user's active reminders)
 */
export async function getRemindersForAutocomplete(
  guildId: string,
  userId: string,
  filter?: string,
): Promise<Array<{ id: string; message: string; triggerAt: Date }>> {
  // Filter in the query so matches beyond the first 25 reminders are found
  const query: Record<string, unknown> = { guildId, userId };
  if (filter) {
    query.message = { $regex: escapeRegex(filter), $options: 'i' };
  }

  const reminders = await Reminder.find(query)
    .sort({ triggerAt: 1 })
    .limit(25)
    .lean();

  return reminders.map((r) => ({
    id: r._id.toString(),
    message: r.message,
    triggerAt: r.triggerAt,
  }));
}
