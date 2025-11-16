import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  User,
  Guild,
} from 'discord.js';
import { SlashCommand } from '@/types';
import { EmbedColors } from '@/utils/embeds.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display the avatar of a user or guild')
    .addStringOption((option) =>
      option
        .setName('target')
        .setDescription('User mention/ID or guild name/ID to get avatar from')
        .setRequired(false),
    ) as SlashCommandBuilder,
  global: true,
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetInput = interaction.options.getString('target');

    if (!targetInput) {
      // Show user's own avatar if no target specified
      const embed = createUserAvatarEmbed(interaction.user);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    await interaction.deferReply();

    try {
      // Try to parse as user mention or ID first
      const userId = extractUserId(targetInput);
      if (userId) {
        try {
          const user = await interaction.client.users.fetch(userId);
          const embed = createUserAvatarEmbed(user);
          await interaction.editReply({ embeds: [embed] });
          return;
        } catch {
          // User not found, continue to guild detection
        }
      }

      // Try to find guild by name or ID
      const guild = findGuild(interaction.client, targetInput);
      if (guild) {
        const embed = await createGuildAvatarEmbed(guild);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Nothing found
      await interaction.editReply({
        content:
          'Could not find a user or guild with that name/ID. Try using a user mention (@user) or exact guild name.',
      });
    } catch (error) {
      console.error('Avatar command error:', error);
      await interaction.editReply({
        content: 'An error occurred while fetching the avatar.',
      });
    }
  },
};

function extractUserId(input: string): string | null {
  // Extract user ID from mention format <@!123456789> or <@123456789>
  const mentionMatch = input.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  // Check if it's a raw user ID (18-19 digit snowflake)
  if (/^\d{17,19}$/.test(input)) {
    return input;
  }

  return null;
}

function findGuild(
  client: { guilds: { cache: Map<string, Guild> } },
  input: string,
): Guild | null {
  // Try to find by exact ID first
  if (/^\d{17,19}$/.test(input)) {
    return client.guilds.cache.get(input) || null;
  }

  // Try to find by name (case insensitive)
  for (const guild of client.guilds.cache.values()) {
    if (guild.name.toLowerCase() === input.toLowerCase()) {
      return guild;
    }
  }
  return null;
}

function createUserAvatarEmbed(user: User): EmbedBuilder {
  const avatarUrl = user.displayAvatarURL({ size: 512, extension: 'png' });
  const avatarUrlJpg = user.displayAvatarURL({ size: 512, extension: 'jpg' });
  const avatarUrlWebp = user.displayAvatarURL({ size: 512, extension: 'webp' });

  const embed = new EmbedBuilder()
    .setTitle(`${user.displayName}'s Avatar`)
    .setDescription(`**${user.tag}** (${user.id})`)
    .setImage(avatarUrl)
    .setColor(EmbedColors.DISCORD_BLURPLE)
    .setFooter({
      text: 'Download Links',
      iconURL: user.displayAvatarURL({ size: 32 }),
    })
    .addFields({
      name: '🔗 Direct Links',
      value: `[PNG](${avatarUrl}) • [JPG](${avatarUrlJpg}) • [WebP](${avatarUrlWebp})`,
      inline: false,
    });

  return embed;
}

async function createGuildAvatarEmbed(guild: Guild): Promise<EmbedBuilder> {
  const iconUrl = guild.iconURL({ size: 512, extension: 'png' });

  if (!iconUrl) {
    throw new Error(`Guild "${guild.name}" does not have an avatar/icon.`);
  }

  const iconUrlJpg = guild.iconURL({ size: 512, extension: 'jpg' });
  const iconUrlWebp = guild.iconURL({ size: 512, extension: 'webp' });

  const embed = new EmbedBuilder()
    .setTitle(`${guild.name}'s Avatar`)
    .setDescription(`**${guild.name}** (${guild.id})`)
    .setImage(iconUrl)
    .setColor(EmbedColors.DISCORD_BLURPLE)
    .setFooter({
      text: 'Download Links',
      iconURL: guild.iconURL({ size: 32 }) || undefined,
    })
    .addFields({
      name: '🔗 Direct Links',
      value: `[PNG](${iconUrl}) • [JPG](${iconUrlJpg}) • [WebP](${iconUrlWebp})`,
      inline: false,
    });

  return embed;
}

export default command;
