import { DDay, type IDDay, type ReminderFrequency } from '#/models/DDay.js';
import { escapeRegex } from '#/utils/regex.js';

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
    { returnDocument: 'after' },
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
  // Filter in the query so matches beyond the first 25 D-Days are found
  const query: Record<string, unknown> = { guildId, userId };
  if (filter) {
    query.title = { $regex: escapeRegex(filter), $options: 'i' };
  }

  const ddays = await DDay.find(query).sort({ targetDate: 1 }).limit(25).lean();

  return ddays.map((d) => ({
    id: d._id.toString(),
    title: d.title,
    targetDate: d.targetDate,
    completed: d.completed,
  }));
}

/**
 * Filter for one D-Day. It names the owner as well as the ID so the change
 * feed can tell the owner's dashboard about the write.
 */
function ownFilter(dday: IDDay) {
  return { _id: dday._id, userId: dday.userId };
}

/** Not waiting to retry a failed notification. */
function notRetrying(now: Date) {
  return { retryAt: { $not: { $gt: now } } };
}

/**
 * D-Days due for a notification. Nothing is changed until the notification
 * has been sent (see markDDayNotified), so a failed send or a crash mid-tick
 * doesn't skip it.
 */
export async function getDueDDayNotifications(): Promise<IDDay[]> {
  const now = new Date();
  return DDay.find({
    nextNotifyAt: { $lte: now },
    completed: false,
    ...notRetrying(now),
  }).lean();
}

/** When the notification after the one due for `dday` should go out. */
function followingNotifyAt(dday: IDDay): Date | null {
  if (dday.nextNotifyAt && dday.nextNotifyAt < dday.targetDate) {
    // After the immediate notification, next alert fires at the target date
    return dday.targetDate;
  }
  // After target date, continue on schedule anchored to previous notification
  return calculateNextNotifyAt(
    dday.nextNotifyAt ?? new Date(),
    dday.reminderFrequency,
  );
}

/** Schedule the next notification once the due one has been sent. */
export async function markDDayNotified(dday: IDDay): Promise<void> {
  await DDay.updateOne(ownFilter(dday), {
    $set: { nextNotifyAt: followingNotifyAt(dday), deliveryAttempts: 0 },
    $unset: { retryAt: 1 },
  });
}

/**
 * Record a failed notification: try again at `retryAt`, or skip it once it
 * has failed `maxAttempts` times. Returns true if it was skipped.
 */
export async function markDDayNotifyFailed(
  dday: IDDay,
  maxAttempts: number,
  retryAt: Date,
): Promise<boolean> {
  const attempts = (dday.deliveryAttempts ?? 0) + 1;
  if (attempts >= maxAttempts) {
    await markDDayNotified(dday);
    return true;
  }
  await DDay.updateOne(ownFilter(dday), {
    $set: { deliveryAttempts: attempts, retryAt },
  });
  return false;
}

/**
 * Handle D-Days whose target date has passed. Recurring ones roll forward a
 * year, and ones already notified are marked completed. Returns the rest,
 * which need a completion notice before they are marked completed (see
 * markDDayCompleted).
 */
export async function processCompletedDDays(): Promise<IDDay[]> {
  const now = new Date();

  const passedDDays = await DDay.find({
    targetDate: { $lte: now },
    completed: false,
    ...notRetrying(now),
  }).lean();

  const toNotify: IDDay[] = [];

  for (const dday of passedDDays) {
    if (dday.recurring) {
      // For recurring D-Days, reset target date to next year
      const newTargetDate = new Date(dday.targetDate);
      newTargetDate.setFullYear(newTargetDate.getFullYear() + 1);

      await DDay.updateOne(ownFilter(dday), {
        $set: { targetDate: newTargetDate },
      });
    } else if (dday.completionNotified) {
      await markDDayCompleted(dday);
    } else {
      toNotify.push(dday);
    }
  }

  return toNotify;
}

/** Mark a passed D-Day completed, after its completion notice was sent. */
export async function markDDayCompleted(
  dday: IDDay,
  notified = true,
): Promise<void> {
  await DDay.updateOne(ownFilter(dday), {
    $set: {
      completed: true,
      nextNotifyAt: null,
      completionNotified: notified || dday.completionNotified,
      deliveryAttempts: 0,
    },
    $unset: { retryAt: 1 },
  });
}

/**
 * Record a failed completion notice: try again at `retryAt`, or mark the
 * D-Day completed without one once it has failed `maxAttempts` times.
 * Returns true if it gave up.
 */
export async function markDDayCompletionFailed(
  dday: IDDay,
  maxAttempts: number,
  retryAt: Date,
): Promise<boolean> {
  const attempts = (dday.deliveryAttempts ?? 0) + 1;
  if (attempts >= maxAttempts) {
    await markDDayCompleted(dday, false);
    return true;
  }
  await DDay.updateOne(ownFilter(dday), {
    $set: { deliveryAttempts: attempts, retryAt },
  });
  return false;
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
