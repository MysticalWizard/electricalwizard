import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  InteractionCollector,
  Message,
} from 'discord.js';

export interface PaginationItem {
  id: string;
  title: string;
  description: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  color?: number;
}

export interface PaginationOptions {
  itemsPerPage?: number;
  timeout?: number;
  showPageNumbers?: boolean;
  showItemCount?: boolean;
  embedTitle?: string;
  embedColor?: number;
}

export class PaginationManager {
  private items: PaginationItem[];
  private currentPage: number = 0;
  private itemsPerPage: number;
  private timeout: number;
  private showPageNumbers: boolean;
  private showItemCount: boolean;
  private embedTitle?: string;
  private embedColor?: number;
  private message?: Message;
  private collector?: InteractionCollector<ButtonInteraction>;

  constructor(items: PaginationItem[], options: PaginationOptions = {}) {
    this.items = items;
    this.itemsPerPage = options.itemsPerPage || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    this.showPageNumbers = options.showPageNumbers ?? true;
    this.showItemCount = options.showItemCount ?? true;
    this.embedTitle = options.embedTitle;
    this.embedColor = options.embedColor || 0x0099ff;
  }

  get totalPages(): number {
    return Math.ceil(this.items.length / this.itemsPerPage);
  }

  get hasMultiplePages(): boolean {
    return this.totalPages > 1;
  }

  private getCurrentPageItems(): PaginationItem[] {
    const startIndex = this.currentPage * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.items.slice(startIndex, endIndex);
  }

  private createEmbed(): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(this.embedColor || 0x0099ff);

    if (this.embedTitle) {
      let title = this.embedTitle;
      if (this.showItemCount) {
        title += ` (${this.items.length} result${this.items.length !== 1 ? 's' : ''})`;
      }
      if (this.showPageNumbers && this.hasMultiplePages) {
        title += ` - Page ${this.currentPage + 1}/${this.totalPages}`;
      }
      embed.setTitle(title);
    }

    const currentItems = this.getCurrentPageItems();

    if (currentItems.length === 1 && !this.hasMultiplePages) {
      // Single item display
      const item = currentItems[0];
      embed.setDescription(item.description);
      if (item.fields) {
        embed.addFields(item.fields);
      }
    } else {
      // Multiple items display
      const descriptions = currentItems.map((item, index) => {
        const globalIndex = this.currentPage * this.itemsPerPage + index + 1;
        return `**${globalIndex}.** ${item.title}\n${item.description}`;
      });

      embed.setDescription(descriptions.join('\n\n'));
    }

    return embed;
  }

  private createActionRow(): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    const firstButton = new ButtonBuilder()
      .setCustomId('pagination_first')
      .setLabel('⏪')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(this.currentPage === 0);

    const prevButton = new ButtonBuilder()
      .setCustomId('pagination_prev')
      .setLabel('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(this.currentPage === 0);

    const pageButton = new ButtonBuilder()
      .setCustomId('pagination_page')
      .setLabel(`${this.currentPage + 1}/${this.totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);

    const nextButton = new ButtonBuilder()
      .setCustomId('pagination_next')
      .setLabel('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(this.currentPage >= this.totalPages - 1);

    const lastButton = new ButtonBuilder()
      .setCustomId('pagination_last')
      .setLabel('⏩')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(this.currentPage >= this.totalPages - 1);

    row.addComponents(
      firstButton,
      prevButton,
      pageButton,
      nextButton,
      lastButton,
    );

    return row;
  }

  private async updateMessage(): Promise<void> {
    const embed = this.createEmbed();
    const components = this.hasMultiplePages ? [this.createActionRow()] : [];

    const messagePayload = {
      content: null,
      embeds: [embed],
      components,
    };

    if (this.message) {
      await this.message.edit(messagePayload);
    }
  }

  private async handleButtonInteraction(
    interaction: ButtonInteraction,
  ): Promise<void> {
    await interaction.deferUpdate();

    switch (interaction.customId) {
      case 'pagination_first':
        this.currentPage = 0;
        break;
      case 'pagination_prev':
        this.currentPage = Math.max(0, this.currentPage - 1);
        break;
      case 'pagination_next':
        this.currentPage = Math.min(this.totalPages - 1, this.currentPage + 1);
        break;
      case 'pagination_last':
        this.currentPage = this.totalPages - 1;
        break;
      default:
        return;
    }

    await this.updateMessage();
  }

  async start(message: Message): Promise<void> {
    this.message = message;
    await this.updateMessage();

    if (!this.hasMultiplePages) {
      return; // No need for pagination with single page
    }

    const filter = (interaction: ButtonInteraction) =>
      interaction.customId.startsWith('pagination_') &&
      interaction.customId !== 'pagination_page';

    try {
      this.collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter,
        time: this.timeout,
      }) as InteractionCollector<ButtonInteraction>;

      this.collector?.on('collect', async (interaction: ButtonInteraction) => {
        try {
          await this.handleButtonInteraction(interaction);
        } catch (error) {
          console.error('Error handling pagination interaction:', error);
        }
      });

      this.collector?.on('end', async () => {
        try {
          // Disable all buttons when collector ends
          const embed = this.createEmbed();
          const row = this.createActionRow();

          // Disable all buttons
          row.components.forEach((button) => button.setDisabled(true));

          if (this.message) {
            await this.message.edit({
              content: null,
              embeds: [embed],
              components: [row],
            });
          }
        } catch {
          // Message might be deleted, ignore error
        }
      });
    } catch (error) {
      console.error('Error setting up pagination collector:', error);
    }
  }

  stop(): void {
    if (this.collector) {
      this.collector.stop();
    }
  }
}
