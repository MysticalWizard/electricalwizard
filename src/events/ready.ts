import { Events } from 'discord.js';
import chalk from 'chalk';
import type { Event } from '#/types.js';
import { Bot } from '#/models/Bot.js';
import { Guild } from '#/models/Guild.js';
import { config } from '#/config.js';
import { startReminderScheduler } from '#/services/scheduler.js';
import { startHeartbeat } from '#/services/heartbeat.js';
import { syncGuildMembers } from '#/services/user.js';

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
      { upsert: true, returnDocument: 'after' },
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
    startHeartbeat(client);

    // Catch members who joined while the bot was offline.
    for (const guild of guilds.values()) {
      try {
        const created = await syncGuildMembers(guild);
        if (created > 0) {
          console.log(
            chalk.dim(`  Added ${created} user(s) from ${guild.name}`),
          );
        }
      } catch (error) {
        console.error(`Failed to sync members of guild ${guild.id}:`, error);
      }
    }
  },
};
