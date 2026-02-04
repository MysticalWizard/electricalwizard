import { DDay, type IDDay, type ReminderFrequency } from '@/models/DDay.js';

export interface CreateDDayData {
  guildId: string;
  channelId: string;
  userId: string;
  title: string;
  targetDate: Date;
  timezone?: string;
  recurring?: boolean;
  private?: boolean;
  reminderFrequency?: ReminderFrequency;
}

/**
 * Calculate next notification time based on frequency
 */
function calculateNextNotifyAt(
  fromDate: Date,
  frequency: ReminderFrequency,
): Date | null {
  if (!frequency) return null;

  const next = new Date(fromDate);

  switch (frequency) {
    case 'everyday':
      next.setDate(next.getDate() + 1);
      break;
    case 'everyweek':
      next.setDate(next.getDate() + 7);
      break;
    case 'everymonth':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'everyyear':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

/**
 * Create a new D-Day with immediate first notification
 */
export async function createDDay(data: CreateDDayData): Promise<IDDay> {
  const now = new Date();

  const dday = new DDay({
    guildId: data.guildId,
    channelId: data.channelId,
    userId: data.userId,
    title: data.title,
    targetDate: data.targetDate,
    timezone: data.timezone,
    recurring: data.recurring ?? false,
    private: data.private ?? false,
    reminderFrequency: data.reminderFrequency ?? null,
    // Set nextNotifyAt to now for immediate first notification
    nextNotifyAt: data.reminderFrequency ? now : null,
    completed: false,
    completionNotified: false,
  });

  return dday.save();
}

/**
 * Get all D-Days for a user in a guild
 */
export async function getUserDDays(
  guildId: string,
  userId: string,
): Promise<IDDay[]> {
  return DDay.find({ guildId, userId }).sort({ targetDate: 1 }).lean();
}

/**
 * Delete a D-Day by ID
 */
export async function deleteDDay(
  ddayId: string,
  userId: string,
): Promise<boolean> {
  const result = await DDay.deleteOne({
    _id: ddayId,
    userId,
  });
  return result.deletedCount > 0;
}

/**
 * Update D-Day reminder settings
 */
export async function updateDDayReminder(
  ddayId: string,
  userId: string,
  frequency: ReminderFrequency,
): Promise<IDDay | null> {
  const now = new Date();

  const update: Record<string, unknown> = {
    reminderFrequency: frequency,
  };

  // Set next notification time based on new frequency
  if (frequency) {
    update.nextNotifyAt = now; // Send notification immediately after updating
  } else {
    update.nextNotifyAt = null;
  }

  return DDay.findOneAndUpdate(
    { _id: ddayId, userId },
    { $set: update },
    { new: true },
  ).lean();
}

/**
 * Get D-Days for autocomplete
 */
export async function getDDaysForAutocomplete(
  guildId: string,
  userId: string,
  filter?: string,
): Promise<
  Array<{ id: string; title: string; targetDate: Date; completed: boolean }>
> {
  const ddays = await DDay.find({ guildId, userId })
    .sort({ targetDate: 1 })
    .limit(25)
    .lean();

  let results = ddays.map((d) => ({
    id: d._id.toString(),
    title: d.title,
    targetDate: d.targetDate,
    completed: d.completed,
  }));

  if (filter) {
    const lowerFilter = filter.toLowerCase();
    results = results.filter((d) =>
      d.title.toLowerCase().includes(lowerFilter),
    );
  }

  return results.slice(0, 25);
}

/**
 * Get due D-Day notifications and update nextNotifyAt
 */
export async function getDueDDayNotifications(): Promise<IDDay[]> {
  const now = new Date();

  // Find D-Days that are due for notification and not completed
  const ddays = await DDay.find({
    nextNotifyAt: { $lte: now },
    completed: false,
  }).lean();

  // Update nextNotifyAt for each D-Day
  for (const dday of ddays) {
    let nextNotifyAt: Date | null;

    if (dday.nextNotifyAt && dday.nextNotifyAt < dday.targetDate) {
      // After the immediate notification, next alert fires at the target date
      nextNotifyAt = dday.targetDate;
    } else {
      // After target date, continue on schedule anchored to previous notification
      const base = dday.nextNotifyAt ?? now;
      nextNotifyAt = calculateNextNotifyAt(base, dday.reminderFrequency);
    }

    await DDay.updateOne({ _id: dday._id }, { $set: { nextNotifyAt } });
  }

  return ddays;
}

/**
 * Process completed D-Days - mark as completed and return those needing notification
 */
export async function processCompletedDDays(): Promise<IDDay[]> {
  const now = new Date();

  // Find D-Days that have passed and need completion handling
  const passedDDays = await DDay.find({
    targetDate: { $lte: now },
    completed: false,
  }).lean();

  const toNotify: IDDay[] = [];

  for (const dday of passedDDays) {
    if (dday.recurring) {
      // For recurring D-Days, reset target date to next year
      const newTargetDate = new Date(dday.targetDate);
      newTargetDate.setFullYear(newTargetDate.getFullYear() + 1);

      await DDay.updateOne(
        { _id: dday._id },
        { $set: { targetDate: newTargetDate } },
      );
    } else {
      // For non-recurring D-Days, mark as completed
      await DDay.updateOne(
        { _id: dday._id },
        {
          $set: {
            completed: true,
            nextNotifyAt: null,
          },
        },
      );

      // Add to notification list if not already notified
      if (!dday.completionNotified) {
        toNotify.push(dday);
        await DDay.updateOne(
          { _id: dday._id },
          { $set: { completionNotified: true } },
        );
      }
    }
  }

  return toNotify;
}

/**
 * Calculate days until/since target date
 * Returns negative if date has passed
 */
export function calculateDaysUntil(targetDate: Date): number {
  const now = new Date();
  // Reset to start of day for accurate day counting
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Format D-Day display string
 * Returns "D-Day", "D-5", or "D+3"
 */
export function formatDDayDisplay(days: number): string {
  if (days === 0) {
    return 'D-Day';
  } else if (days > 0) {
    return `D-${days}`;
  } else {
    return `D+${Math.abs(days)}`;
  }
}
