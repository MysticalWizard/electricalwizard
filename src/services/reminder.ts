import { Reminder, type IReminder } from '#/models/Reminder.js';
import { User } from '#/models/User.js';
import { escapeRegex } from '#/utils/regex.js';

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
  await Reminder.deleteOne({ _id: reminder._id });
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
    await Reminder.deleteOne({ _id: reminder._id });
    return true;
  }
  await Reminder.updateOne(
    { _id: reminder._id },
    { $set: { deliveryAttempts: attempts, retryAt } },
  );
  return false;
}

/**
 * Get used timezones by users for autocomplete
 */
export async function getUsedTimezones(): Promise<string[]> {
  // Get unique timezones from users who have set one
  const users = await User.find(
    { timezone: { $exists: true, $ne: null } },
    { timezone: 1 },
  ).lean();

  const timezones = [...new Set(users.map((u) => u.timezone).filter(Boolean))];
  return timezones as string[];
}

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
