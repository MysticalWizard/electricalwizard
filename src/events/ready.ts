import { ActivityType, Client, Events } from 'discord.js';
import chalk from 'chalk';
import config from '@/config.js';
import { Event } from '@/types';

const event: Event<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client<true>) => {
    console.log(`Logged in as ${chalk.cyanBright(client.user?.tag)}`);
    client.user.setActivity(config.bot.status, {
      type: ActivityType.Custom,
    });
  },
};

export default event;
