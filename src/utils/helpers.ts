import config from '@/config.js';
import UserModel from '@/models/User.js';

export const validFileExtension =
  config.bot.env === 'production' ? '.js' : '.ts';

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
