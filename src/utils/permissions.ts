import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import config from '@/config.js';

/**
 * Check if a user is the bot owner or has administrator permissions
 */
export function isOwnerOrAdmin(
  interaction: ChatInputCommandInteraction,
): boolean {
  const isOwner = interaction.user.id === config.bot.ownerId;
  const isAdmin = !!interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator,
  );
  return isOwner || isAdmin;
}

/**
 * Check if a user is the bot owner
 */
export function isOwner(userId: string): boolean {
  return userId === config.bot.ownerId;
}

/**
 * Check if a user has administrator permissions
 */
export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  return !!interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator,
  );
}

/**
 * Reply with a permission denied message
 */
export async function replyPermissionDenied(
  interaction: ChatInputCommandInteraction,
  message = 'You need Administrator permissions or be the bot owner to use this command.',
): Promise<void> {
  await interaction.reply({
    content: message,
    ephemeral: true,
  });
}
