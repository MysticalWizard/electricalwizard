import { AutocompleteInteraction, Events, Interaction } from 'discord.js';
import { Event, SlashCommand } from '@/types';

const handleAutocomplete = async (interaction: AutocompleteInteraction) => {
  const command = interaction.client.commands.get(
    interaction.commandName,
  ) as SlashCommand;

  if (!command.autocomplete) {
    console.error(
      `No autocomplete handler for ${interaction.commandName} was found.`,
    );
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    console.error('Error in autocomplete handler:', error);
  }
};

const handleCommand = async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Error executing command:', error);
    const reply = {
      content: 'There was an error while executing this command!',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
};

const event: Event<Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  execute: async (interaction: Interaction) => {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
    } else {
      await handleCommand(interaction);
    }
  },
};

export default event;
