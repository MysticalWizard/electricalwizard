import { Events } from 'discord.js';
import type { Event } from '#/types.js';
import { Guild } from '#/models/Guild.js';
import { syncGuildMembers } from '#/services/user.js';

export const event: Event<Events.GuildCreate> = {
  name: Events.GuildCreate,
  once: false,
  async execute(guild) {
    await Guild.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { name: guild.name } },
      { upsert: true },
    );

    try {
      await syncGuildMembers(guild);
    } catch (error) {
      console.error(`Failed to sync members of guild ${guild.id}:`, error);
    }
  },
};
