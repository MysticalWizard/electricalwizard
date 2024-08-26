import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@/types';
import fs from 'fs';

const command: SlashCommand = {
  data: new SlashCommandBuilder().setName('info').setDescription('Bot info.'),
  global: true,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const version = packageJson.version;
    await interaction.reply(
      `ElectricalWizard Discord Bot (Version: ${version})`,
    );
  },
};

export default command;
