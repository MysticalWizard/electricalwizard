import {
  ActivityType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import StatusModel from '@/models/Status.js';
import { SlashCommand } from '@/types';
import { isOwnerOrAdmin, replyPermissionDenied } from '@/utils/permissions.js';
import { UserService } from '@/services/user.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription("Change the bot's status message")
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The new status message')
        .setRequired(true),
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator,
    ) as SlashCommandBuilder,

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    // Check if user is bot owner or has administrator permissions
    if (!isOwnerOrAdmin(interaction)) {
      await replyPermissionDenied(
        interaction,
        'You need Administrator permissions or be the bot owner to change the status.',
      );
      return;
    }

    const newStatus = interaction.options.getString('message', true);

    try {
      // Find or create the user using UserService
      const user = await UserService.findOrCreateUser(
        interaction.user.id,
        interaction.user.username,
      );

      // Update the status
      await StatusModel.findOneAndUpdate(
        {},
        {
          message: newStatus,
          updatedAt: new Date(),
          updatedBy: user._id, // Reference to the User document
        },
        { upsert: true },
      );

      interaction.client.user.setActivity(newStatus, {
        type: ActivityType.Custom,
      });
      await interaction.reply(`Bot status updated to: ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      await interaction.reply(
        'Failed to update status. Please try again later.',
      );
    }
  },
};

export default command;
