import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import UserModel from '@/models/User.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('createuser')
    .setDescription('Populate or update user information in the database')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Discord user to add or update')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('given_name').setDescription('Given (first) name'),
    )
    .addStringOption((option) =>
      option
        .setName('preferred_name')
        .setDescription('Preferred given name (if different from given name)'),
    )
    .addStringOption((option) =>
      option.setName('family_name').setDescription('Family (last) name'),
    )
    .addStringOption((option) =>
      option
        .setName('nicknames')
        .setDescription('Comma-separated list of nicknames'),
    )
    .addStringOption((option) =>
      option
        .setName('birthday')
        .setDescription('Birthday in YYYY-MM-DD format'),
    ) as SlashCommandBuilder,

  execute: async (interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user', true);
    const givenName = interaction.options.getString('given_name');
    const preferredName = interaction.options.getString('preferred_name');
    const familyName = interaction.options.getString('family_name');
    const nicknames = interaction.options.getString('nicknames');
    const birthday = interaction.options.getString('birthday');

    try {
      const userData = {
        userId: user.id,
        username: user.username,
        name: {
          first: {
            given: givenName,
            preferred: preferredName,
          },
          family: familyName,
        },
        nicknames: nicknames
          ? nicknames.split(',').map((nick) => nick.trim())
          : undefined,
        birthday: birthday ? new Date(birthday) : undefined,
      };

      const updatedUser = await UserModel.findOneAndUpdate(
        { userId: user.id },
        userData,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      await interaction.editReply({
        content: `User information for ${user.username} (ID: ${user.id}) has been successfully ${
          updatedUser ? 'updated' : 'added'
        } in the database.`,
      });
    } catch (error) {
      console.error('Error populating user data:', error);
      await interaction.editReply({
        content:
          'There was an error while populating the user data. Please try again later.',
      });
    }
  },
};

export default command;
