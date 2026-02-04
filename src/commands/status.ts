import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { Bot } from '@/models/Bot.js';
import { BotStatus, BotActivityType } from '@/enums.js';
import { config } from '@/config.js';
import { colors, createEmbed } from '@/utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription("Manage the bot's status")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('state')
        .setDescription('The presence state of the bot')
        .addChoices(
          { name: 'Online', value: BotStatus.Online },
          { name: 'Idle', value: BotStatus.Idle },
          { name: 'Do Not Disturb', value: BotStatus.DoNotDisturb },
          { name: 'Invisible', value: BotStatus.Invisible },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('activity')
        .setDescription('The activity type')
        .addChoices(
          { name: 'None', value: 'none' },
          { name: 'Playing', value: String(BotActivityType.Playing) },
          { name: 'Streaming', value: String(BotActivityType.Streaming) },
          { name: 'Listening', value: String(BotActivityType.Listening) },
          { name: 'Watching', value: String(BotActivityType.Watching) },
          { name: 'Competing', value: String(BotActivityType.Competing) },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The status message')
        .setMaxLength(128),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const state = interaction.options.getString('state');
    const activity = interaction.options.getString('activity');
    const message = interaction.options.getString('message');

    if (!state && !activity && message === null) {
      const botConfig = await Bot.findOne({ clientId: config.clientId });

      const embed = createEmbed()
        .setTitle('Bot Status')
        .setColor(colors.primary)
        .addFields(
          { name: 'State', value: botConfig?.status ?? 'online', inline: true },
          {
            name: 'Activity',
            value: getActivityName(botConfig?.activityType ?? null),
            inline: true,
          },
          {
            name: 'Message',
            value: botConfig?.activityName || 'None',
            inline: true,
          },
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const update: Record<string, unknown> = {};

    if (state) update.status = state;
    if (activity) {
      update.activityType = activity === 'none' ? null : Number(activity);
    }
    if (message !== null) update.activityName = message;

    const botConfig = await Bot.findOneAndUpdate(
      { clientId: config.clientId },
      update,
      { new: true, upsert: true },
    );

    interaction.client.user.setPresence({
      status: botConfig.status,
      activities:
        botConfig.activityName && botConfig.activityType !== null
          ? [{ type: botConfig.activityType, name: botConfig.activityName }]
          : [],
    });

    const embed = createEmbed()
      .setTitle('Status Updated')
      .setColor(colors.success)
      .addFields(
        { name: 'State', value: botConfig.status, inline: true },
        {
          name: 'Activity',
          value: getActivityName(botConfig.activityType),
          inline: true,
        },
        {
          name: 'Message',
          value: botConfig.activityName || 'None',
          inline: true,
        },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

function getActivityName(activityType: number | null): string {
  if (activityType === null) return 'None';

  const names: Record<number, string> = {
    [BotActivityType.Playing]: 'Playing',
    [BotActivityType.Streaming]: 'Streaming',
    [BotActivityType.Listening]: 'Listening',
    [BotActivityType.Watching]: 'Watching',
    [BotActivityType.Competing]: 'Competing',
    [BotActivityType.Custom]: 'Custom',
  };

  return names[activityType] ?? 'Unknown';
}
