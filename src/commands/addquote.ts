import {
  AutocompleteInteraction,
  CommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { QuoteService } from '@/services/quote.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('addquote')
    .setDescription('Adds a quote.')
    .addStringOption((option) =>
      option
        .setName('quote')
        .setDescription('The infamous quote to be recorded in history.')
        .setMaxLength(1000)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('author')
        .setDescription('The GOAT author of this priceless quote.')
        .setMaxLength(40)
        .setAutocomplete(true)
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('year')
        .setDescription('The year when this quote was born.')
        .setMinValue(0)
        .setMaxValue(2100)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('context')
        .setDescription('Give context for this quowote. (optional)'),
    )
    .addStringOption((option) =>
      option
        .setName('link')
        .setDescription('id of the quote to link to. (optional)')
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('override')
        .setDescription(
          'id of the quote to override. (Admin only - use with caution!)',
        )
        .setAutocomplete(true),
    ) as SlashCommandBuilder,
  cooldown: 5,

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'author') {
      await handleAuthorAutocomplete(interaction, focusedOption.value);
    } else if (
      focusedOption.name === 'link' ||
      focusedOption.name === 'override'
    ) {
      await handleQuoteAutocomplete(interaction, 5);
    }
  },

  execute: async (interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const quoteContent = interaction.options.getString('quote', true);
    const author = interaction.options.getString('author', true);
    const year = interaction.options.getInteger('year', true);
    const context = interaction.options.getString('context');
    const linkId = interaction.options.getString('link');
    const overrideId = interaction.options.getString('override');

    const result = await QuoteService.addQuote(
      {
        quote: quoteContent,
        author,
        year,
        context: context || undefined,
        linkId: linkId || undefined,
      },
      {
        allowOverride: !!overrideId,
        isAdmin: !!interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator,
        ),
        overrideId: overrideId || undefined,
      },
    );

    await interaction.editReply({ embeds: [result.embed] });
  },
};

async function handleAuthorAutocomplete(
  interaction: AutocompleteInteraction,
  focusedValue: string,
) {
  const choices = await QuoteService.getAutocompleteChoices('author');
  const filtered = choices.filter((choice) =>
    choice.toLowerCase().startsWith(focusedValue.toLowerCase()),
  );
  await interaction.respond(
    filtered.map((choice) => ({ name: choice, value: choice })),
  );
}

async function handleQuoteAutocomplete(
  interaction: AutocompleteInteraction,
  count: number,
) {
  const choices = await QuoteService.getAutocompleteChoices('quote', count);
  await interaction.respond(choices);
}

export default command;
