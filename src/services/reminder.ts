import { Reminder, type IReminder } from '@/models/Reminder.js';
import { User } from '@/models/User.js';

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
 * Get all due reminders (triggerAt <= now) and delete them atomically
 */
export async function getDueReminders(): Promise<IReminder[]> {
  const now = new Date();
  const reminders = await Reminder.find({ triggerAt: { $lte: now } }).lean();

  if (reminders.length > 0) {
    await Reminder.deleteMany({
      _id: { $in: reminders.map((r) => r._id) },
    });
  }

  return reminders;
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
  const query: Record<string, unknown> = { guildId, userId };

  const reminders = await Reminder.find(query)
    .sort({ triggerAt: 1 })
    .limit(25)
    .lean();

  let results = reminders.map((r) => ({
    id: r._id.toString(),
    message: r.message,
    triggerAt: r.triggerAt,
  }));

  if (filter) {
    const lowerFilter = filter.toLowerCase();
    results = results.filter((r) =>
      r.message.toLowerCase().includes(lowerFilter),
    );
  }

  return results.slice(0, 25);
}
