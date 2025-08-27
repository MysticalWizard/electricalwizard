import { EmbedBuilder } from 'discord.js';
import { Types } from 'mongoose';
import QuoteModel from '@/models/Quote.js';

export interface QuoteData {
  quote: string;
  author: string;
  year: number;
  context?: string;
  linkId?: string;
}

export interface QuoteValidationOptions {
  allowOverride?: boolean;
  isAdmin?: boolean;
  overrideId?: string;
}

export interface QuoteResult {
  success: boolean;
  embed: EmbedBuilder;
  quoteId?: string;
}

export class QuoteService {
  static async addQuote(
    data: QuoteData,
    options: QuoteValidationOptions = {},
  ): Promise<QuoteResult> {
    try {
      const { quote, author, year, context, linkId } = data;
      const { allowOverride, isAdmin, overrideId } = options;

      // Handle quote override
      if (overrideId && allowOverride) {
        if (!isAdmin) {
          return {
            success: false,
            embed: new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('❌ Permission Denied')
              .setDescription(
                'You need administrator permissions to override quotes.',
              ),
          };
        }

        const existingQuote = await QuoteModel.findById(overrideId);
        if (!existingQuote) {
          return {
            success: false,
            embed: new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('❌ Quote Not Found')
              .setDescription(
                'The quote you are trying to override does not exist.',
              ),
          };
        }

        // Update existing quote
        existingQuote.quote = quote;
        existingQuote.author = author;
        existingQuote.year = year;
        if (context) existingQuote.context = context;
        if (linkId) existingQuote.link = new Types.ObjectId(linkId);

        await existingQuote.save();

        const formattedQuote = `"${quote}" — ${author}${context ? `, ${context}` : ''}, ${year}`;

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle(`✨ Quote #${overrideId} Updated!`)
          .addFields({
            name: 'Formatted Quote',
            value: formattedQuote,
            inline: false,
          })
          .setTimestamp();

        return {
          success: true,
          embed,
          quoteId: overrideId,
        };
      }

      // Validate link if provided
      if (linkId) {
        const linkValidation = await this.validateQuoteLink(linkId);
        if (!linkValidation.success) {
          return linkValidation;
        }
      }

      // Create new quote
      const newQuote = new QuoteModel({
        quote,
        author,
        year,
        context,
        link: linkId ? new Types.ObjectId(linkId) : undefined,
      });

      await newQuote.save();

      const quoteCount = await QuoteModel.countDocuments();
      const formattedQuote = `"${quote}" — ${author}${context ? `, ${context}` : ''}, ${year}`;

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`✅ Quote #${quoteCount} Added!`)
        .addFields({
          name: 'Formatted Quote',
          value: formattedQuote,
          inline: false,
        })
        .setTimestamp();

      if (linkId) {
        const linkedQuote = await QuoteModel.findById(linkId);
        if (linkedQuote) {
          const truncatedQuote =
            linkedQuote.quote.length > 50
              ? `${linkedQuote.quote.substring(0, 50)}...`
              : linkedQuote.quote;
          embed.addFields({
            name: '🔗 Linked Quote',
            value: `"${truncatedQuote}" (#${linkedQuote._id})`,
            inline: false,
          });
        }
      }

      return {
        success: true,
        embed,
        quoteId: newQuote._id.toString(),
      };
    } catch (error) {
      console.error('Error adding or updating quote:', error);

      return {
        success: false,
        embed: new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Database Error')
          .setDescription(
            'There was an error while adding or updating the quote. Please try again later.',
          )
          .setTimestamp(),
      };
    }
  }

  private static async validateQuoteLink(linkId: string): Promise<QuoteResult> {
    // Check for double links
    const existingLink = await QuoteModel.findOne({ link: linkId });
    if (existingLink) {
      return {
        success: false,
        embed: new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Double Link Error')
          .setDescription('This quote is already linked to another quote.'),
      };
    }

    // Check for circular links and maximum chain length
    const chainLength = await this.checkCircularAndChainLength(linkId);
    if (chainLength === -1) {
      return {
        success: false,
        embed: new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Circular Link Error')
          .setDescription(
            'Circular link detected. This would create an infinite loop.',
          ),
      };
    }

    if (chainLength >= 5) {
      return {
        success: false,
        embed: new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Chain Length Error')
          .setDescription(
            'Maximum chain length (5) reached. Cannot link more quotes in this chain.',
          ),
      };
    }

    return {
      success: true,
      embed: new EmbedBuilder(), // Unused for success case
    };
  }

  private static async checkCircularAndChainLength(
    quoteId: string,
  ): Promise<number> {
    const result = await QuoteModel.aggregate([
      { $match: { _id: new Types.ObjectId(quoteId) } },
      {
        $graphLookup: {
          from: 'quotes',
          startWith: '$link',
          connectFromField: 'link',
          connectToField: '_id',
          as: 'chain',
          maxDepth: 10,
          depthField: 'depth',
        },
      },
      {
        $project: {
          chainLength: { $add: [{ $size: '$chain' }, 1] },
          hasCircular: {
            $gt: [{ $size: { $setIntersection: [['$_id'], '$chain._id'] } }, 0],
          },
        },
      },
    ]);

    if (result.length === 0) return 1;

    const { chainLength, hasCircular } = result[0];
    return hasCircular ? -1 : chainLength;
  }

  static async getAutocompleteChoices(type: 'author' | 'quote', limit = 5) {
    if (type === 'author') {
      const popularAuthors = await QuoteModel.aggregate([
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, author: '$_id' } },
      ]);

      const recentAuthor = await QuoteModel.findOne()
        .sort({ _id: -1 })
        .select('author');

      return [
        ...new Set([
          ...popularAuthors.map((a) => a.author),
          recentAuthor ? recentAuthor.author : '',
        ]),
      ].filter(Boolean);
    } else {
      const recentQuotes = await QuoteModel.find()
        .sort({ _id: -1 })
        .limit(limit)
        .lean();

      return recentQuotes.map((quote) => ({
        name: `${quote.quote.substring(0, 50)}...`,
        value: quote._id.toString(),
      }));
    }
  }
}
