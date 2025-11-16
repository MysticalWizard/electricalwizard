import { ChatInputCommandInteraction, Interaction } from 'discord.js';

/**
 * Safely reply to an interaction, handling already replied/deferred cases
 */
export async function safeReply(
  interaction: ChatInputCommandInteraction | Interaction,
  content: string,
  ephemeral = true,
): Promise<void> {
  const reply = {
    content,
    ephemeral,
  };

  if (!interaction.isRepliable()) {
    return;
  }

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(reply);
  } else {
    await interaction.reply(reply);
  }
}

/**
 * Safely edit a reply to an interaction
 */
export async function safeEditReply(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content });
  } else {
    await interaction.reply({ content });
  }
}
