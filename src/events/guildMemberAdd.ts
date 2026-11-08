import { Events } from 'discord.js';
import type { Event } from '#/types.js';
import { ensureUser } from '#/services/user.js';

export const event: Event<Events.GuildMemberAdd> = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    try {
      await ensureUser(member.user);
    } catch (error) {
      console.error(`Failed to create user ${member.id}:`, error);
    }
  },
};
