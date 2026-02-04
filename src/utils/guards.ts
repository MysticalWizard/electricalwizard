import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';

/**
 * Guard that ensures the interaction is in a guild.
 * Replies with an ephemeral error if not, and returns false.
 * When it returns true, interaction.guild is guaranteed non-null.
 */
export async function requireGuild(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

/**
 * Check if a guild member has Administrator permission.
 */
export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}
