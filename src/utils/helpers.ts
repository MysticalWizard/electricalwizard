import config from '@/config.js';
import UserModel from '@/models/User.js';

export const validFileExtension =
  config.bot.env === 'production' ? '.js' : '.ts';

export function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export async function formatAuthorName(
  userId: string,
  username: string,
): Promise<string> {
  const user = await UserModel.findOne({ userId: userId });

  if (user && user.name) {
    if (user.name.first.preferred && user.name.family) {
      return `${user.name.first.preferred.charAt(0)}. ${user.name.family}`;
    }

    if (user.name.first.given && user.name.family) {
      return `${user.name.first.given.charAt(0)}. ${user.name.family}`;
    }

    if (user.name.first.given) {
      return user.name.first.given;
    }

    if (user.name.family) {
      return user.name.family;
    }
  }

  return username;
}
