import {
  AutocompleteInteraction,
  ButtonInteraction,
  Events,
  Interaction,
} from 'discord.js';
import QuoteModel, { IQuote } from '@/models/Quote.js';
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

const handleButton = async (interaction: Interaction) => {
  if (!interaction.isButton()) return;

  // Handle quote deletion buttons
  if (
    interaction.customId.startsWith('confirm_delete_') ||
    interaction.customId.startsWith('cancel_delete_')
  ) {
    await handleQuoteDeletionButton(interaction);
  }
};

async function handleQuoteDeletionButton(interaction: ButtonInteraction) {
  try {
    const [action, , quoteId, chainFlag] = interaction.customId.split('_');

    if (action === 'cancel') {
      // Cancel the operation
      await interaction.update({
        content: 'Quote deletion cancelled.',
        components: [],
      });
      return;
    }

    if (action === 'confirm') {
      // Delete the quote(s)
      const deleteChain = chainFlag === 'true';

      const quote = await QuoteModel.findById(quoteId);
      if (!quote) {
        await interaction.update({
          content: 'Quote not found.',
          components: [],
        });
        return;
      }

      if (deleteChain) {
        // Delete all quotes in the chain
        const quotesToDelete = await getQuoteChain(quote);
        const deletedCount = quotesToDelete.length;

        // Get all quote numbers
        const quoteNumbers: number[] = [];
        for (const q of quotesToDelete) {
          const quoteNumber = await QuoteModel.countDocuments({
            _id: { $lte: q._id },
          });
          quoteNumbers.push(quoteNumber);
        }

        // Delete all quotes in the chain
        await QuoteModel.deleteMany({
          _id: { $in: quotesToDelete.map((q) => q._id) },
        });

        await interaction.update({
          content: `Successfully deleted ${deletedCount} quote(s) in the chain: #${quoteNumbers.join(', #')}.`,
          components: [],
        });
      } else {
        // Get quote number before deletion
        const quoteNumber = await QuoteModel.countDocuments({
          _id: { $lte: quote._id },
        });

        // Delete single quote
        await QuoteModel.findByIdAndDelete(quoteId);

        // Fix any quotes that were linking to this one
        await QuoteModel.updateMany(
          { link: quoteId },
          { $unset: { link: '' } },
        );

        await interaction.update({
          content: `Quote #${quoteNumber} successfully deleted.`,
          components: [],
        });
      }
    }
  } catch (error) {
    console.error('Error handling quote deletion button:', error);
    await interaction.update({
      content: 'An error occurred while processing the deletion.',
      components: [],
    });
  }
}

// Helper function to get all quotes in a chain
async function getQuoteChain(
  quote: IQuote,
  visited: Set<string> = new Set(),
): Promise<IQuote[]> {
  const chain = [quote];
  visited.add(quote._id.toString());

  // Find quotes that link to this quote
  const linkedToThisQuote = await QuoteModel.find({ link: quote._id });
  for (const linkedQuote of linkedToThisQuote) {
    if (!visited.has(linkedQuote._id.toString())) {
      const subChain = await getQuoteChain(linkedQuote, visited);
      chain.push(...subChain);
    }
  }

  // Follow the link if this quote has one
  if (quote.link && !visited.has(quote.link.toString())) {
    const linkedQuote = await QuoteModel.findById(quote.link);
    if (linkedQuote) {
      const subChain = await getQuoteChain(linkedQuote, visited);
      chain.push(...subChain);
    }
  }

  return chain;
}

const event: Event<Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  execute: async (interaction: Interaction) => {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else {
      await handleCommand(interaction);
    }
  },
};

export default event;
