import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { SlashCommand } from '@/types.js';
import { User } from '@/models/User.js';
import type { IQuote } from '@/models/Quote.js';
import {
  addQuote,
  canDeleteQuote,
  deleteQuote,
  findDuplicateQuote,
  getQuoteAuthors,
  getQuoteByNumber,
  getQuotesByAuthor,
  getQuotesByAuthorAndYear,
  getQuotesByYear,
  getRandomQuotes,
  getUsersWithNames,
} from '@/services/quote.js';
import {
  formatNameWithInitials,
  formatQuoteDisplay,
  getFormattedUserName,
} from '@/utils/formatName.js';
import { colors, createEmbed } from '@/utils/embeds.js';
import { requireGuild, isAdmin } from '@/utils/guards.js';

async function formatQuoteForDisplay(quote: IQuote): Promise<string> {
  let displayName = quote.authorName ?? 'Unknown';

  if (quote.authorId && !quote.authorName) {
    const result = await getFormattedUserName(quote.authorId, displayName);
    displayName = result.name;
  }

  return formatQuoteDisplay(
    quote.content,
    displayName,
    quote.year,
    quote.context,
  );
}

async function handleAdd(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const content = interaction.options.getString('content', true);
  const authorInput = interaction.options.getString('author', true);
  const year = interaction.options.getInteger('year', true);
  const context = interaction.options.getString('context') ?? undefined;

  let authorId: string | undefined;
  let authorName: string | undefined;

  if (/^\d+$/.test(authorInput)) {
    const user = await User.findOne({ discordId: authorInput }).lean();
    if (user) {
      authorId = authorInput;
      authorName = formatNameWithInitials(user.name?.first, user.name?.last);
    } else {
      authorName = authorInput;
    }
  } else {
    authorName = authorInput;
  }

  const duplicate = await findDuplicateQuote(
    interaction.guild!.id,
    content,
    authorId,
    authorName,
  );

  if (duplicate) {
    await interaction.reply({
      content: `This quote already exists as #${duplicate.quoteNumber}.`,
      ephemeral: true,
    });
    return;
  }

  const quote = await addQuote({
    guildId: interaction.guild!.id,
    content,
    authorId,
    authorName,
    year,
    context,
    addedById: interaction.user.id,
  });

  const displayText = formatQuoteDisplay(content, authorName!, year, context);

  await interaction.reply(`Quote #${quote.quoteNumber} added: ${displayText}`);
}

async function handleGet(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const id = interaction.options.getInteger('id');
  const authorInput = interaction.options.getString('author');
  const year = interaction.options.getInteger('year');
  const count = interaction.options.getInteger('count') ?? 1;

  const guildId = interaction.guild!.id;
  let quotes: IQuote[];

  if (id !== null) {
    const quote = await getQuoteByNumber(guildId, id);
    if (!quote) {
      await interaction.reply({
        content: `Quote #${id} not found.`,
        ephemeral: true,
      });
      return;
    }
    quotes = [quote];
  } else if (authorInput && year) {
    quotes = await getQuotesByAuthorAndYear(guildId, authorInput, year, count);
  } else if (authorInput) {
    quotes = await getQuotesByAuthor(guildId, authorInput, count);
  } else if (year) {
    quotes = await getQuotesByYear(guildId, year, count);
  } else {
    quotes = await getRandomQuotes(guildId, count);
  }

  if (quotes.length === 0) {
    await interaction.reply({
      content: 'No quotes found matching your criteria.',
      ephemeral: true,
    });
    return;
  }

  const quoteLines = await Promise.all(
    quotes.map(async (quote) => {
      return await formatQuoteForDisplay(quote);
    }),
  );

  await interaction.reply(quoteLines.join('\n\n'));
}

async function handleRandom(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const count = interaction.options.getInteger('count') ?? 1;
  const guildId = interaction.guild!.id;

  const quotes = await getRandomQuotes(guildId, count);

  if (quotes.length === 0) {
    await interaction.reply({
      content: 'No quotes found in this server.',
      ephemeral: true,
    });
    return;
  }

  const quoteLines = await Promise.all(
    quotes.map(async (quote) => {
      return await formatQuoteForDisplay(quote);
    }),
  );

  await interaction.reply(quoteLines.join('\n\n'));
}

async function handleDelete(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const id = interaction.options.getInteger('id', true);
  const member = interaction.member as GuildMember;

  const quote = await getQuoteByNumber(interaction.guild!.id, id);

  if (!quote) {
    await interaction.reply({
      content: `Quote #${id} not found.`,
      ephemeral: true,
    });
    return;
  }

  if (!canDeleteQuote(quote, interaction.user.id, isAdmin(member))) {
    await interaction.reply({
      content:
        'You can only delete quotes you created or quotes about yourself.',
      ephemeral: true,
    });
    return;
  }

  const formatted = await formatQuoteForDisplay(quote);

  const embed = createEmbed()
    .setTitle('Delete Quote?')
    .setColor(colors.warning)
    .setDescription(`**#${quote.quoteNumber}** ${formatted}`)
    .setFooter({ text: 'This action cannot be undone.' });

  const cancelButton = new ButtonBuilder()
    .setCustomId('quote_delete_cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger);

  const confirmButton = new ButtonBuilder()
    .setCustomId('quote_delete_confirm')
    .setLabel('Confirm')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    cancelButton,
    confirmButton,
  );

  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });

  try {
    const buttonInteraction = await response.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 30_000,
    });

    if (buttonInteraction.customId === 'quote_delete_confirm') {
      const result = await deleteQuote(interaction.guild!.id, id);

      let description = `Quote #${id} has been deleted.`;
      if (result.slotsFreed > 0) {
        description += ` (${result.slotsFreed} slot${result.slotsFreed === 1 ? '' : 's'} freed)`;
      }

      const successEmbed = createEmbed()
        .setTitle('Quote Deleted')
        .setColor(colors.success)
        .setDescription(description);

      await buttonInteraction.update({
        embeds: [successEmbed],
        components: [],
      });
    } else {
      const cancelEmbed = createEmbed()
        .setTitle('Cancelled')
        .setColor(colors.danger)
        .setDescription('Quote deletion cancelled.');

      await buttonInteraction.update({
        embeds: [cancelEmbed],
        components: [],
      });
    }
  } catch {
    const timeoutEmbed = createEmbed()
      .setTitle('Timed Out')
      .setColor(colors.danger)
      .setDescription('Quote deletion timed out.');

    await interaction.editReply({
      embeds: [timeoutEmbed],
      components: [],
    });
  }
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Manage and view quotes')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a new quote')
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('The quote text')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('author')
            .setDescription(
              'Who said the quote (select user or type custom name)',
            )
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('year')
            .setDescription('Year the quote was said')
            .setRequired(true)
            .setMinValue(1900)
            .setMaxValue(2100),
        )
        .addStringOption((option) =>
          option
            .setName('context')
            .setDescription('Additional context for the quote'),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('get')
        .setDescription('Get a quote by ID, author, or year')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('Specific quote number')
            .setMinValue(1),
        )
        .addStringOption((option) =>
          option
            .setName('author')
            .setDescription('Filter by author')
            .setAutocomplete(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('year')
            .setDescription('Filter by year')
            .setMinValue(1900)
            .setMaxValue(2100),
        )
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('Number of quotes to return (1-10)')
            .setMinValue(1)
            .setMaxValue(10),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('random')
        .setDescription('Get random quotes')
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('Number of quotes to return (1-10)')
            .setMinValue(1)
            .setMaxValue(10),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a quote')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('Quote number to delete')
            .setRequired(true)
            .setMinValue(1),
        ),
    ) as SlashCommandBuilder,

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();

    if (focusedOption.name === 'author') {
      if (subcommand === 'add') {
        const usersWithNames = await getUsersWithNames();
        const filtered = usersWithNames
          .filter((user) =>
            user.displayName
              .toLowerCase()
              .includes(focusedOption.value.toLowerCase()),
          )
          .slice(0, 25);

        await interaction.respond(
          filtered.map((user) => ({
            name: user.displayName,
            value: user.discordId,
          })),
        );
      } else if (subcommand === 'get') {
        if (!interaction.guild) return;

        const authors = await getQuoteAuthors(interaction.guild.id);

        const authorChoices = await Promise.all(
          authors.slice(0, 25).map(async (author) => {
            const user = await User.findOne({
              discordId: author.authorId,
            }).lean();
            const displayName = user?.name?.first
              ? formatNameWithInitials(user.name.first, user.name.last)
              : (user?.username ?? 'Unknown');

            return {
              name: `${displayName} (${author.count} quote${author.count === 1 ? '' : 's'})`,
              value: author.authorId,
            };
          }),
        );

        const filtered = authorChoices.filter((choice) =>
          choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
        );

        await interaction.respond(filtered);
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireGuild(interaction))) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await handleAdd(interaction);
        break;
      case 'get':
        await handleGet(interaction);
        break;
      case 'random':
        await handleRandom(interaction);
        break;
      case 'delete':
        await handleDelete(interaction);
        break;
    }
  },
};
