import {
  ActivityType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import StatusModel from '@/models/Status.js';
import UserModel from '@/models/User.js';
import { SlashCommand } from '@/types';

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

    const newStatus = interaction.options.getString('message', true);

    try {
      // Find or create the user in the UserModel
      const user = await UserModel.findOneAndUpdate(
        { userId: interaction.user.id },
        { username: interaction.user.username },
        { upsert: true, new: true },
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
