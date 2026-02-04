import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { User } from '@/models/User.js';

dayjs.extend(customParseFormat);

const DATE_FORMATS = ['MM/DD/YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD'];

export function parseBirthday(input: string): Date | null {
  const parsed = dayjs(input.trim(), DATE_FORMATS, true);
  return parsed.isValid() ? parsed.toDate() : null;
}

export function formatBirthday(date: Date): string {
  return dayjs(date).format('MMMM D, YYYY');
}

export async function getBirthday(discordId: string): Promise<Date | null> {
  const user = await User.findOne({ discordId }).lean();
  return user?.birthday ?? null;
}

export async function upsertBirthday(
  discordId: string,
  username: string,
  birthday: Date,
): Promise<void> {
  await User.findOneAndUpdate(
    { discordId },
    { discordId, username, birthday },
    { upsert: true },
  );
}
