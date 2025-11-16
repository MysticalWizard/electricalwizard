import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import QuoteModel from '@/models/Quote.js';
import { SlashCommand } from '@/types';
import { isOwnerOrAdmin, replyPermissionDenied } from '@/utils/permissions.js';
import { QuoteService } from '@/services/quote.js';
import { truncate, formatQuote } from '@/utils/strings.js';

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
        const truncatedQuote = truncate(quote.quote, 50);
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
    // Check if user is bot owner or has administrator permissions
    if (!isOwnerOrAdmin(interaction)) {
      await replyPermissionDenied(
        interaction,
        'You need Administrator permissions or be the bot owner to delete quotes.',
      );
      return;
    }

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
        `Quote #${quoteNumber}: ${formatQuote(quote.quote, quote.author, quote.year, quote.context)}`,
      ];

      if (deleteChain) {
        // Get all linked quotes using QuoteService
        const linkedQuotes = await QuoteService.getQuoteChain(quote);

        // Format all quotes for display
        for (const linkedQuote of linkedQuotes) {
          if (linkedQuote._id.toString() !== quoteId) {
            const linkedQuoteNumber = await QuoteModel.countDocuments({
              _id: { $lte: linkedQuote._id },
            });
            formattedQuotes.push(
              `Quote #${linkedQuoteNumber}: ${formatQuote(linkedQuote.quote, linkedQuote.author, linkedQuote.year, linkedQuote.context)}`,
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

export default command;
