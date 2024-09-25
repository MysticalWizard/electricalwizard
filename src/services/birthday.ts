import { Client, TextChannel } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import config from '@/config';
import GuildModel from '@/models/Guild.js';
import UserModel, { IUser } from '@/models/User.js';
import { getOrdinal } from '@/utils/helpers';

dayjs.extend(utc);
dayjs.extend(timezone);

export class BirthdayService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async startBirthdayCheck(): Promise<void> {
    console.log(`Starting birthday check service (interval: 1 hr)`);
    // Calculate time until the next hour
    const now = dayjs();
    const nextHour = now.startOf('hour').add(1, 'hour');
    const msUntilNextHour = nextHour.diff(now);

    // Schedule the first check at the next hour
    setTimeout(() => {
      this.runBirthdayCheck();
      setInterval(() => this.runBirthdayCheck(), 60 * 60 * 1000);
    }, msUntilNextHour);

    console.log(
      `Next birthday check scheduled for ${nextHour.format('YYYY-MM-DD HH:mm:ss')}`,
    );
  }

  private async runBirthdayCheck(): Promise<void> {
    try {
      console.log(
        `Checking birthdays at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
      );
      await this.checkBirthdays();
    } catch (error) {
      console.error('Error during birthday check:', error);
    }
  }

  private async checkBirthdays(): Promise<void> {
    console.log('Checking for birthdays...');
    const users = await UserModel.find({ birthday: { $exists: true } });
    const now = dayjs();

    for (const user of users) {
      const userBirthday = dayjs(user.birthday);
      const userTimezone = user.birthdayTimezone || 0; // Default to UTC if not set
      const current = now.tz(userTimezone.toString());

      if (
        userBirthday.month() === current.month() &&
        userBirthday.date() === current.date() &&
        current.hour() === 0 // Only announce between 0:00 and 0:59 or 0 to 59 minute of specified timezone
      ) {
        await this.sendBirthdayMessages(user);
      }
    }
  }

  private async sendBirthdayMessages(user: IUser): Promise<void> {
    const now = dayjs();
    const birthDate = dayjs(user.birthday);
    const age = now.year() - birthDate.year();
    const ordinal = getOrdinal(age);

    // Send DM
    // try {
    //   const discordUser = await this.client.users.fetch(user.userId);
    //   await discordUser.send(`Happy birthday, ${user.username}! 🎉🎂`);
    // } catch (error) {
    //   console.error(`Error sending birthday DM to user ${user.userId}:`, error);
    // }

    // Send message in guild channel
    try {
      const guild = await GuildModel.findOne({ guildId: config.guild.id });
      if (guild && guild.birthdayChannelId) {
        const birthdayChannel = (await this.client.channels.fetch(
          guild.birthdayChannelId,
        )) as TextChannel;
        if (birthdayChannel && birthdayChannel.isTextBased()) {
          await birthdayChannel.send(
            `Today is <@${user.userId}>'s ${age}${ordinal} birthday! 🎉🎂 Wish them a happy birthday!`,
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
