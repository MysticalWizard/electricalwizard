import {
  SlashCommandBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';
import UserModel, { IUser } from '@/models/User.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Manage nicknames for a user')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add one or more nicknames')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Discord User')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('nicknames')
            .setDescription('Comma-separated list of nicknames to add')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('modify')
        .setDescription('Modify a single nickname')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Discord User')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('old_nickname')
            .setDescription('The nickname to be modified')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName('new_nickname')
            .setDescription('The new nickname')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove one or more nicknames')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Discord User')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('nicknames')
            .setDescription('Comma-separated list of nicknames to remove')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List all nicknames for a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Discord User')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription('Clear all nicknames for a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Discord User')
            .setRequired(true),
        ),
    ) as SlashCommandBuilder,

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.options.getString('user');
    const focusedValue = interaction.options
      .getFocused()
      .toString()
      .toLowerCase();

    if (!userId) return;

    try {
      const dbUser = await UserModel.findOne({ userId });
      if (!dbUser || !dbUser.nicknames) return;

      let choices: string[] = [];

      if (subcommand === 'modify' || subcommand === 'remove') {
        choices = dbUser.nicknames;
      }

      const filtered = choices.filter((choice) =>
        choice.toLowerCase().includes(focusedValue),
      );

      await interaction.respond(
        filtered.map((choice) => ({ name: choice, value: choice })),
      );
    } catch (error) {
      console.error('Error in nickname autocomplete:', error);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);

    try {
      let dbUser = await UserModel.findOne({ userId: user.id });

      if (!dbUser) {
        // If user doesn't exist in the database, create a new one
        dbUser = new UserModel({
          userId: user.id,
          username: user.username,
          nicknames: [],
        });
        await dbUser.save();
      }

      switch (subcommand) {
        case 'add':
          await handleAddNicknames(interaction, dbUser);
          break;
        case 'modify':
          await handleModifyNickname(interaction, dbUser);
          break;
        case 'remove':
          await handleRemoveNicknames(interaction, dbUser);
          break;
        case 'list':
          await handleListNicknames(interaction, dbUser);
          break;
        case 'clear':
          await handleClearNicknames(interaction, dbUser);
          break;
      }
    } catch (error) {
      console.error('Error in nickname command:', error);
      await interaction.editReply({
        content: 'An error occurred while processing the command.',
      });
    }
  },
};

// Handler functions remain the same
async function handleAddNicknames(
  interaction: ChatInputCommandInteraction,
  user: IUser,
) {
  const nicknamesString = interaction.options.getString('nicknames', true);
  const newNicknames = nicknamesString.split(',').map((nick) => nick.trim());

  user.nicknames = [...new Set([...(user.nicknames || []), ...newNicknames])];
  await user.save();

  await interaction.editReply({
    content: `Added ${newNicknames.length} nickname(s) for user ${user.username}.`,
  });
}

async function handleModifyNickname(
  interaction: ChatInputCommandInteraction,
  user: IUser,
) {
  const oldNickname = interaction.options.getString('old_nickname', true);
  const newNickname = interaction.options.getString('new_nickname', true);

  const index = user.nicknames.indexOf(oldNickname);
  if (index === -1) {
    await interaction.editReply({
      content: `Nickname "${oldNickname}" not found for user ${user.username}.`,
    });
    return;
  }

  user.nicknames[index] = newNickname;
  await user.save();

  await interaction.editReply({
    content: `Modified nickname for user ${user.username}: "${oldNickname}" -> "${newNickname}".`,
  });
}

async function handleRemoveNicknames(
  interaction: ChatInputCommandInteraction,
  user: IUser,
) {
  const nicknamesString = interaction.options.getString('nicknames', true);
  const nicknamesToRemove = nicknamesString
    .split(',')
    .map((nick) => nick.trim());

  user.nicknames = user.nicknames.filter(
    (nick) => !nicknamesToRemove.includes(nick),
  );
  await user.save();

  await interaction.editReply({
    content: `Removed ${nicknamesToRemove.length} nickname(s) for user ${user.username}.`,
  });
}

async function handleListNicknames(
  interaction: ChatInputCommandInteraction,
  user: IUser,
) {
  const nicknamesList = user.nicknames.join(', ');
  await interaction.editReply({
    content: `Nicknames for user ${user.username}: ${nicknamesList}`,
  });
}

async function handleClearNicknames(
  interaction: ChatInputCommandInteraction,
  user: IUser,
) {
  const clearedNicknames = [...user.nicknames];
  user.nicknames = [];
  await user.save();

  const nicknamesList = clearedNicknames.join(', ');
  await interaction.editReply({
    content: `Cleared all nicknames for user ${user.username}. Cleared nicknames: ${nicknamesList}`,
  });
}

export default command;
