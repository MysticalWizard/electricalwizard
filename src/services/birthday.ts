import { Client, TextChannel } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import config from '@/config.js';
import GuildModel from '@/models/Guild.js';
import UserModel, { IUser } from '@/models/User.js';
import { getOrdinal } from '@/utils/helpers.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export class BirthdayService {
  private client: Client;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  public async startBirthdayCheck(): Promise<void> {
    if (config.logging.debug) {
      console.log(`Starting birthday check service (interval: 1 hr)`);
    }

    // Stop any existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Calculate time until the next hour
    const now = dayjs();
    const nextHour = now.startOf('hour').add(1, 'hour');
    const msUntilNextHour = nextHour.diff(now);

    // Schedule the first check at the next hour
    setTimeout(() => {
      this.runBirthdayCheck();
      // Use setInterval for consistent timing
      this.checkInterval = setInterval(
        () => this.runBirthdayCheck(),
        60 * 60 * 1000,
      );
    }, msUntilNextHour);

    if (config.logging.debug) {
      console.log(
        `Next birthday check scheduled for ${nextHour.format('YYYY-MM-DD HH:mm:ss')}`,
      );
    }
  }

  public stopBirthdayCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      if (config.logging.debug) {
        console.log('Birthday check service stopped');
      }
    }
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
    if (config.logging.debug) {
      console.log('Checking for birthdays...');
    }

    try {
      const users = await UserModel.find({ birthday: { $exists: true } });
      const now = dayjs.utc();

      for (const user of users) {
        try {
          await this.checkUserBirthday(user, now);
        } catch (error) {
          console.error(
            `Error checking birthday for user ${user.userId}:`,
            error,
          );
          // Continue with other users even if one fails
        }
      }
    } catch (error) {
      console.error('Error fetching users for birthday check:', error);
    }
  }

  private async checkUserBirthday(
    user: IUser,
    now: dayjs.Dayjs,
  ): Promise<void> {
    const userBirthday = dayjs(user.birthday);
    const userTimezone = user.birthdayTimezone || 0; // Default to UTC if not set

    // Calculate current time in user's timezone using UTC offset
    const userCurrentTime = now.utcOffset(userTimezone * 60);

    // Check if it's the user's birthday today in their timezone
    const isBirthdayToday =
      userBirthday.month() === userCurrentTime.month() &&
      userBirthday.date() === userCurrentTime.date();

    // Only send if it's between 0:00 and 0:59 in their timezone
    const isCorrectHour = userCurrentTime.hour() === 0;

    if (isBirthdayToday && isCorrectHour) {
      // Check if we already sent notification today
      const today = userCurrentTime.format('YYYY-MM-DD');
      const lastNotification = user.lastBirthdayNotification
        ? dayjs(user.lastBirthdayNotification).format('YYYY-MM-DD')
        : null;

      if (lastNotification !== today) {
        await this.sendBirthdayMessages(user, userCurrentTime);

        // Update last notification date
        user.lastBirthdayNotification = userCurrentTime.toDate();
        await user.save();
      }
    }
  }

  private async sendBirthdayMessages(
    user: IUser,
    userCurrentTime: dayjs.Dayjs,
  ): Promise<void> {
    const birthDate = dayjs(user.birthday);

    // Calculate age correctly - account for whether birthday has passed this year
    let age = userCurrentTime.year() - birthDate.year();
    const birthdayThisYear = birthDate.year(userCurrentTime.year());

    // If birthday hasn't occurred yet this year, subtract 1 from age
    if (userCurrentTime.isBefore(birthdayThisYear)) {
      age -= 1;
    }

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
