import { ActivityType, Client, Events } from 'discord.js';
import chalk from 'chalk';
import config from '@/config.js';
import StatusModel from '@/models/Status.js';
import { createBirthdayService } from '@/services/birthday.js';
import { Event } from '@/types';

const event: Event<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client<true>) => {
    console.log(`Logged in as ${chalk.cyanBright(client.user?.tag)}`);

    // Set the bot's status
    try {
      // Fetch the status entry from the database
      const statusDoc = await StatusModel.findOne().exec();
      let statusMessage = config.bot.status; // Default status from config
      if (statusDoc && statusDoc.message) {
        statusMessage = statusDoc.message;
      }
      client.user.setActivity(statusMessage, {
        type: ActivityType.Custom,
      });
      console.log(
        `Bot activity status set to: ${chalk.greenBright(statusMessage)}`,
      );
    } catch (error) {
      console.error('Error setting bot status:', error);
      // Fallback to default status if there's an error
      client.user.setActivity(config.bot.status, {
        type: ActivityType.Custom,
      });
    }

    // Start the birthday check service
    try {
      const birthdayService = createBirthdayService(client);
      birthdayService.startBirthdayCheck();
    } catch (error) {
      console.error('Error starting birthday check service:', error);
    }

    console.log(chalk.green(':: READY! ::'));
  },
};

export default event;
