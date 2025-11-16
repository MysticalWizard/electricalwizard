import { EmbedBuilder } from 'discord.js';

/**
 * Standard embed colors used throughout the bot
 */
export const EmbedColors = {
  PRIMARY: 0x0099ff,
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  WARNING: 0xffa500,
  INFO: 0x5865f2,
  DISCORD_BLURPLE: 0x5865f2,
} as const;

/**
 * Create a success embed
 */
export function createSuccessEmbed(
  title: string,
  description?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setTitle(title);

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Create an error embed
 */
export function createErrorEmbed(
  title: string,
  description?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(EmbedColors.ERROR).setTitle(title);

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Create an info embed
 */
export function createInfoEmbed(
  title: string,
  description?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.PRIMARY)
    .setTitle(title);

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Create a warning embed
 */
export function createWarningEmbed(
  title: string,
  description?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.WARNING)
    .setTitle(title);

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}
