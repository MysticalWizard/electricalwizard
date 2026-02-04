import type { AutocompleteInteraction } from 'discord.js';

/**
 * Respond to a timezone autocomplete interaction.
 *
 * When the user has typed something, filters `timezones` by the input.
 * When the input is empty and `fallback` is provided, uses `fallback` instead.
 * When the input is empty and no fallback is provided, shows the first 25 timezones.
 */
export async function respondTimezoneAutocomplete(
  interaction: AutocompleteInteraction,
  timezones: string[],
  fallback?: string[],
): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();

  let choices: string[];

  if (!focused && fallback) {
    choices = fallback.length > 0 ? fallback : timezones.slice(0, 25);
  } else {
    choices = timezones
      .filter((tz) => tz.toLowerCase().includes(focused))
      .slice(0, 25);
  }

  await interaction.respond(choices.map((tz) => ({ name: tz, value: tz })));
}
