import chalk from 'chalk';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { config } from '@/config.js';
import type { SlashCommand } from '@/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function banner(): void {
  console.log();
  console.log(chalk.cyan.bold('  ╔══════════════════════════════════════╗'));
  console.log(
    chalk.cyan.bold('  ║   ') +
      chalk.magenta('⚡') +
      chalk.cyan.bold(' ElectricalWizard ') +
      chalk.cyan.dim('Command Deploy') +
      chalk.cyan.bold('  ║'),
  );
  console.log(chalk.cyan.bold('  ╚══════════════════════════════════════╝'));
  console.log();
}

interface CommandData {
  global: unknown[];
  guild: unknown[];
}

async function loadCommandData(): Promise<CommandData> {
  const commands: CommandData = { global: [], guild: [] };
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(
    (file) => file.endsWith('.ts') || file.endsWith('.js'),
  );

  console.log(
    chalk.blue.bold('  ● Loading commands... ') +
      chalk.dim(`(${commandFiles.length} files found)`),
  );
  console.log();

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const { command } = (await import(filePath)) as { command: SlashCommand };

    if ('data' in command && 'execute' in command) {
      const target = command.global ? 'global' : 'guild';
      const icon = target === 'global' ? chalk.cyan('◆') : chalk.magenta('◇');
      const label =
        target === 'global' ? chalk.cyan('global') : chalk.magenta('guild ');
      commands[target].push(command.data.toJSON());
      console.log(
        `    ${icon} ${chalk.bold.white('/' + command.data.name)} ${chalk.dim('─')} ${label}`,
      );
    } else {
      console.warn(
        `    ${chalk.yellow('⚠')} ${chalk.yellow(file)} ${chalk.dim('─ missing "data" or "execute"')}`,
      );
    }
  }

  console.log();
  return commands;
}

async function deploy(): Promise<void> {
  banner();

  const commands = await loadCommandData();
  const rest = new REST().setToken(config.botToken);

  try {
    if (commands.global.length > 0) {
      console.log(
        chalk.blue.bold('  ● Deploying ') +
          chalk.cyan.bold(`${commands.global.length}`) +
          chalk.blue.bold(' global command(s)...'),
      );
      const data = (await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands.global },
      )) as unknown[];
      console.log(
        chalk.green.bold(`    ✔ ${data.length} global command(s) deployed`),
      );
    }

    if (commands.guild.length > 0) {
      console.log(
        chalk.blue.bold('  ● Deploying ') +
          chalk.magenta.bold(`${commands.guild.length}`) +
          chalk.blue.bold(' guild command(s)...'),
      );
      const data = (await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands.guild },
      )) as unknown[];
      console.log(
        chalk.green.bold(`    ✔ ${data.length} guild command(s) deployed`),
      );
    }

    if (commands.global.length === 0 && commands.guild.length === 0) {
      console.log(chalk.yellow.bold('  ⚠ No commands found to deploy.'));
    }

    const total = commands.global.length + commands.guild.length;
    console.log();
    console.log(chalk.green.bold('  ══════════════════════════════════════'));
    console.log(
      chalk.green.bold('  ⚡ Deploy complete! ') +
        chalk.dim(`${total} command(s) registered`),
    );
    console.log(chalk.green.bold('  ══════════════════════════════════════'));
    console.log();
  } catch (error) {
    console.log();
    console.error(chalk.red.bold('  ══════════════════════════════════════'));
    console.error(chalk.red.bold('  ✘ Deploy failed!'));
    console.error(chalk.red.bold('  ══════════════════════════════════════'));
    console.error(chalk.red.dim(String(error)));
    console.log();
    process.exit(1);
  }
}

deploy();
