import { Events } from 'discord.js';
import chalk from 'chalk';
import type { Event } from '@/types.js';
import { Bot } from '@/models/Bot.js';
import { Guild } from '@/models/Guild.js';
import { config } from '@/config.js';
import { startReminderScheduler } from '@/services/scheduler.js';

export const event: Event<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(
      chalk.bold.green('✓ Ready! Logged in as ') +
        chalk.bold.cyan(client.user.tag),
    );

    const botConfig = await Bot.findOneAndUpdate(
      { clientId: config.clientId },
      { $setOnInsert: { clientId: config.clientId } },
      { upsert: true, new: true },
    );

    client.user.setPresence({
      status: botConfig.status,
      activities:
        botConfig.activityName && botConfig.activityType !== null
          ? [{ type: botConfig.activityType, name: botConfig.activityName }]
          : [],
    });

    const guilds = client.guilds.cache;
    await Promise.all(
      guilds.map((guild) =>
        Guild.findOneAndUpdate(
          { guildId: guild.id },
          { $set: { name: guild.name } },
          { upsert: true },
        ),
      ),
    );

    startReminderScheduler(client);
  },
};
