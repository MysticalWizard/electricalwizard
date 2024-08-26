import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import GuildModel from '@/models/Guild.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Channel configs for the bot.')
    .addChannelOption((option) =>
      option
        .setName('bot')
        .setDescription('The channel where bot commands are used.')
        .addChannelTypes(ChannelType.GuildText),
    )
    .addChannelOption((option) =>
      option
        .setName('welcome')
        .setDescription('The channel to send welcome messages to.')
        .addChannelTypes(ChannelType.GuildText),
    )
    .addChannelOption((option) =>
      option
        .setName('birthday')
        .setDescription('The channel to send birthday messages to.')
        .addChannelTypes(ChannelType.GuildText),
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator,
    ) as SlashCommandBuilder,

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const botChannel = interaction.options.getChannel('bot');
    const welcomeChannel = interaction.options.getChannel('welcome');
    const birthdayChannel = interaction.options.getChannel('birthday');

    if (!botChannel && !welcomeChannel && !birthdayChannel) {
      await interaction.reply({
        content: 'Please provide at least one channel to configure.',
        ephemeral: true,
      });
      return;
    }

    try {
      const guildId = interaction.guild.id;
      let guild = await GuildModel.findOne({ guildId });

      if (!guild) {
        guild = new GuildModel({ guildId });
      }

      if (botChannel) guild.botChannelId = botChannel.id;
      if (welcomeChannel) guild.welcomeChannelId = welcomeChannel.id;
      if (birthdayChannel) guild.birthdayChannelId = birthdayChannel.id;

      await guild.save();

      const updatedChannels = [
        botChannel && 'bot',
        welcomeChannel && 'welcome',
        birthdayChannel && 'birthday',
      ].filter(Boolean);

      await interaction.reply({
        content: `Successfully updated ${updatedChannels.join(', ')} channel${
          updatedChannels.length > 1 ? 's' : ''
        } configuration.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error updating guild channels:', error);
      await interaction.reply({
        content: 'An error occurred while updating the channel configuration.',
        ephemeral: true,
      });
    }
  },
};

export default command;
