import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { SlashCommand } from '@/types';
import config from '@/config.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Display bot uptime and system information')
    .addBooleanOption((option) =>
      option
        .setName('detailed')
        .setDescription('Show detailed system statistics')
        .setRequired(false),
    ) as SlashCommandBuilder,
  global: true,
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const showDetailed = interaction.options.getBoolean('detailed') || false;

    // Check permissions for detailed view
    if (showDetailed) {
      const isOwner = interaction.user.id === config.bot.ownerId;
      const isAdmin =
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        false;

      if (!isOwner && !isAdmin) {
        await interaction.reply({
          content:
            'You need Administrator permissions or be the bot owner to view detailed statistics.',
          ephemeral: true,
        });
        return;
      }
    }

    const embed = createUptimeEmbed(showDetailed);
    await interaction.reply({ embeds: [embed] });
  },
};

function createUptimeEmbed(detailed: boolean): EmbedBuilder {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  // Format uptime
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  let uptimeString = '';
  if (days > 0) uptimeString += `${days}d `;
  if (hours > 0) uptimeString += `${hours}h `;
  if (minutes > 0) uptimeString += `${minutes}m `;
  uptimeString += `${seconds}s`;

  const embed = new EmbedBuilder()
    .setTitle('🤖 Bot Uptime')
    .setColor(0x00ff00)
    .addFields(
      {
        name: '⏱️ Uptime',
        value: uptimeString,
        inline: true,
      },
      {
        name: '📊 Memory Usage',
        value: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        inline: true,
      },
      {
        name: '🚀 Started',
        value: `<t:${Math.floor(Date.now() / 1000 - uptime)}:R>`,
        inline: true,
      },
    )
    .setTimestamp();

  if (detailed) {
    embed.addFields(
      {
        name: '💾 Heap Total',
        value: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        inline: true,
      },
      {
        name: '🔄 External',
        value: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        inline: true,
      },
      {
        name: '📈 RSS',
        value: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        inline: true,
      },
      {
        name: '⚙️ Node.js Version',
        value: process.version,
        inline: true,
      },
      {
        name: '🖥️ Platform',
        value: `${process.platform} ${process.arch}`,
        inline: true,
      },
      {
        name: '📊 Process ID',
        value: process.pid.toString(),
        inline: true,
      },
    );
  }

  return embed;
}

export default command;
