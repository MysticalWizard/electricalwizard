import { Events, Guild } from 'discord.js';
import GuildModel from '@/models/Guild.js';
import { Event } from '@/types';

const event: Event<Events.GuildCreate> = {
  name: Events.GuildCreate,
  execute: async (guild: Guild) => {
    try {
      await GuildModel.create({ guildId: guild.id });
    } catch (error) {
      console.error('Error creating guild document:', error);
    }
  },
};

export default event;
