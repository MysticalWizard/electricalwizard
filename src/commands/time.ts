import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import type { SlashCommand } from '@/types';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const timezones = [
  { name: 'uʍop ǝpᴉsdՈ', zone: 'Australia/Melbourne', label: 'Melbourne' },
  { name: 'tif & wansi', zone: 'Asia/Tokyo', label: 'Tokyo/Seoul' },
  { name: 'good food', zone: 'Asia/Shanghai', label: 'Shanghai' },
  { name: 'oh mein time', zone: 'Europe/Berlin', label: 'EU' },
  { name: 'Kock', zone: 'Europe/London', label: 'London' },
  { name: '🦅', zone: 'America/New_York', label: 'US East' },
  { name: 'Tim Hortons', zone: 'America/Vancouver', label: 'Vancouver' },
];

const formatTime = (timezone: string): string =>
  dayjs().tz(timezone).format('YYYY-MM-DD HH:mm:ss');

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('time')
    .setDescription('Shows the current time across the world'),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const embed = new EmbedBuilder().setTitle('Time').addFields(
      timezones.map(({ name, zone, label }) => ({
        name,
        value: `${formatTime(zone)} (${label})`,
      })),
    );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
