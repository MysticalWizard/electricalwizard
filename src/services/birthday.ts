import { Client, TextChannel } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import config from '@/config.js';
import UserModel, { IUser } from '@/models/User.js';
import GuildModel from '@/models/Guild.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export class BirthdayService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async startBirthdayCheck(
    intervalInMinutes: number = 60,
  ): Promise<void> {
    console.log(
      `Starting birthday check service (interval: ${intervalInMinutes} minutes)`,
    );
    setInterval(() => this.checkBirthdays(), intervalInMinutes * 60 * 1000);
  }

  private async checkBirthdays(): Promise<void> {
    console.log('Checking for birthdays...');
    const users = await UserModel.find({ birthday: { $exists: true } });

    for (const user of users) {
      const birthday = dayjs(user.birthday).utcOffset(user.birthdayTimezone);
      const now = dayjs().utcOffset(user.birthdayTimezone);

      if (birthday.month() === now.month() && birthday.date() === now.date()) {
        await this.sendBirthdayMessages(user);
      }
    }
  }

  private async sendBirthdayMessages(user: IUser): Promise<void> {
    // Send DM
    try {
      const discordUser = await this.client.users.fetch(user.userId);
      await discordUser.send(`Happy birthday, ${user.username}! 🎉🎂`);
    } catch (error) {
      console.error(`Error sending birthday DM to user ${user.userId}:`, error);
    }

    // Send message in guild channel
    try {
      const guild = await GuildModel.findOne({ guildId: config.guild.id });
      if (guild && guild.birthdayChannelId) {
        const birthdayChannel = (await this.client.channels.fetch(
          guild.birthdayChannelId,
        )) as TextChannel;
        if (birthdayChannel && birthdayChannel.isTextBased()) {
          await birthdayChannel.send(
            `Today is <@${user.userId}>'s birthday! 🎉🎂 Wish them a happy birthday!`,
          );
        }
      }
    } catch (error) {
      console.error(
        `Error sending guild birthday message for user ${user.userId}:`,
        error,
      );
    }
  }
}

export const createBirthdayService = (client: Client): BirthdayService => {
  return new BirthdayService(client);
};
