import { EmbedBuilder } from 'discord.js';

export const colors = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
} as const;

export function createEmbed() {
  return new EmbedBuilder().setColor(colors.primary);
}
