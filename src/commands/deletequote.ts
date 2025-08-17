import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import QuoteModel, { IQuote } from '@/models/Quote.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('deletequote')
    .setDescription('Delete a quote or a chain of quotes')
    .addStringOption((option) =>
      option
        .setName('quote')
        .setDescription('The quote to delete')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addBooleanOption((option) =>
      option
        .setName('chain')
        .setDescription('Delete entire quote chain (if applicable)')
        .setRequired(false),
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator,
    ) as SlashCommandBuilder,
  cooldown: 5,

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focusedValue = interaction.options.getFocused();

    try {
      // Search for quotes matching the input
      let quotes;
      if (focusedValue) {
        quotes = await QuoteModel.find({
          $or: [
            { quote: { $regex: focusedValue, $options: 'i' } },
            { author: { $regex: focusedValue, $options: 'i' } },
          ],
        })
          .sort({ _id: -1 })
          .limit(25);
      } else {
        // If no input, show recent quotes
        quotes = await QuoteModel.find().sort({ _id: -1 }).limit(25);
      }

      const choices = quotes.map((quote) => {
        const truncatedQuote =
          quote.quote.length > 50
            ? `${quote.quote.substring(0, 50)}...`
            : quote.quote;
        return {
          name: `${truncatedQuote} - ${quote.author}`,
          value: quote._id.toString(),
        };
      });

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in deletequote autocomplete:', error);
      await interaction.respond([]);
    }
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const quoteId = interaction.options.getString('quote', true);
    const deleteChain = interaction.options.getBoolean('chain') || false;

    try {
      // Find the quote
      const quote = await QuoteModel.findById(quoteId);
      if (!quote) {
        await interaction.editReply('Quote not found.');
        return;
      }

      // Find the quote number (position in sorted list)
      const quoteNumber = await QuoteModel.countDocuments({
        _id: { $lte: quote._id },
      });

      // Find all quotes in the chain if requested
      const formattedQuotes = [
        `Quote #${quoteNumber}: "${quote.quote}" — ${quote.author}, ${quote.year}`,
      ];

      if (deleteChain) {
        // Get all linked quotes
        const linkedQuotes = await getQuoteChain(quote);

        // Format all quotes for display
        for (const linkedQuote of linkedQuotes) {
          if (linkedQuote._id.toString() !== quoteId) {
            const linkedQuoteNumber = await QuoteModel.countDocuments({
              _id: { $lte: linkedQuote._id },
            });
            formattedQuotes.push(
              `Quote #${linkedQuoteNumber}: "${linkedQuote.quote}" — ${linkedQuote.author}, ${linkedQuote.year}`,
            );
          }
        }
      }

      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_delete_${quoteId}_${deleteChain}`)
        .setLabel('Confirm Delete')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_delete_${quoteId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmButton,
        cancelButton,
      );

      // Create confirmation message
      const confirmationMessage = deleteChain
        ? `Are you sure you want to delete the following quotes in the chain?\n\n${formattedQuotes.join('\n\n')}`
        : `Are you sure you want to delete this quote?\n\n${formattedQuotes[0]}`;

      await interaction.editReply({
        content: confirmationMessage,
        components: [row],
      });
    } catch (error) {
      console.error('Error in deletequote command:', error);
      await interaction.editReply(
        'An error occurred while processing the command.',
      );
    }
  },
};

// Helper function to get all quotes in a chain using aggregation
async function getQuoteChain(quote: IQuote): Promise<IQuote[]> {
  const result = await QuoteModel.aggregate([
    { $match: { _id: quote._id } },
    {
      $graphLookup: {
        from: 'quotes',
        startWith: '$_id',
        connectFromField: 'link',
        connectToField: '_id',
        as: 'linkedQuotes',
        maxDepth: 10,
        depthField: 'depth'
      }
    },
    {
      $graphLookup: {
        from: 'quotes', 
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'link',
        as: 'linkingQuotes',
        maxDepth: 10,
        depthField: 'depth'
      }
    },
    {
      $project: {
        allQuotes: {
          $concatArrays: [
            [{ _id: '$_id', quote: '$quote', author: '$author', year: '$year', context: '$context', link: '$link' }],
            '$linkedQuotes',
            '$linkingQuotes'
          ]
        }
      }
    },
    { $unwind: '$allQuotes' },
    { $replaceRoot: { newRoot: '$allQuotes' } },
    {
      $group: {
        _id: '$_id',
        quote: { $first: '$quote' },
        author: { $first: '$author' },
        year: { $first: '$year' },
        context: { $first: '$context' },
        link: { $first: '$link' }
      }
    }
  ]);

  return result;
}

export default command;
