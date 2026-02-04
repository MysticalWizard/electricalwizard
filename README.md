# ElectricalWizard

A Discord bot secretary for a small private server with friends — the n-th circle of hell. Built with TypeScript, Discord.js v14, and MongoDB.

## Features

- Slash commands
- Birthday tracking and reminders
- D-Day countdowns
- Quote collection from messages
- Nickname detection and automatic mentioning
- Scheduled reminders with timezone support
- Per-guild persistent storage

## Design Notes

- Strict TypeScript with ESM
- Clear separation between Discord I/O and business logic
- Services are framework-agnostic and testable in isolation
- MongoDB schema design favors per-guild isolation

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/)
- [MongoDB](https://www.mongodb.com/)
- A [Discord application](https://discord.com/developers/applications) with a bot token

## Setup

1. **Clone the repository**

   ```sh
   git clone https://github.com/MysticalWizard/electricalwizard.git
   cd electricalwizard
   ```

2. **Install dependencies**

   ```sh
   pnpm install
   ```

3. **Configure environment variables**

   ```sh
   cp .env.example .env
   ```

   Edit `.env` with your values:

   ```
   BOT_TOKEN=YOUR_BOT_TOKEN
   CLIENT_ID=YOUR_APPLICATION_ID
   GUILD_ID=YOUR_SERVER_ID
   OWNER_ID=YOUR_USER_ID

   MONGODB_HOST=localhost:27017
   MONGODB_DB=electricalwizard
   # MONGODB_USER=
   # MONGODB_PASSWORD=
   ```

   > This project assumes a locally running MongoDB instance by default.
   > Authentication is optional and can be enabled via `MONGODB_USER` / `MONGODB_PASSWORD`.

4. **Deploy slash commands**

   ```sh
   pnpm deploy
   ```

   > This registers all slash commands with Discord. Commands marked as global are available everywhere; guild commands are registered to `GUILD_ID`.

5. **Start the bot**

   ```sh
   # Development (hot reload)
   pnpm dev

   # Production
   pnpm build
   pnpm start
   ```

## Production Deployment

The bot includes [PM2](https://pm2.keymetrics.io/) scripts for process management:

```sh
pnpm pm2:start      # Start the bot
pnpm pm2:watch      # Start with file watching
pnpm pm2:stop       # Stop the bot
pnpm pm2:restart    # Restart the bot
pnpm pm2:logs       # View logs
pnpm pm2:delete     # Remove from PM2
```

> These scripts are intended for simple single-instance deployments.

Make sure to run `pnpm build` before using PM2 commands.

## Project Structure

```
src/
  commands/      # Slash command definitions
  events/        # Discord event handlers
  models/        # Mongoose schemas (User, Guild, Quote...)
  services/      # Business logic (database, nickname, scheduler...)
  utils/         # Shared utilities (autocomplete, embeds, loaders...)
  config.ts      # Environment configuration
  deploy.ts      # Command registration script
  main.ts        # Bot entry point
  types.ts       # TypeScript interfaces
  enums.ts       # Enum definitions
```

## Development

```sh
pnpm lint        # Run ESLint
pnpm lint:fix    # Fix lint issues
pnpm format      # Format with Prettier
pnpm format:check # Check formatting
```

A pre-commit hook (via [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged)) automatically lints and formats staged files.

## Required Gateway Intents

When inviting the bot to a server, it needs the following [gateway intents](https://discord.com/developers/docs/events/gateway#gateway-intents):

- **Guilds** - Track guild membership
- **Guild Members** - Access member lists and user data
- **Guild Messages** - Read messages for quote capture and nickname detection
- **Message Content** - Read message content (privileged intent)

## Tech Stack

- **Runtime**: Node.js with ESM modules
- **Language**: TypeScript (strict mode)
- **Discord Library**: [discord.js](https://discord.js.org/) v14
- **Database**: MongoDB via [Mongoose](https://mongoosejs.com/)
- **Date Handling**: [Day.js](https://day.js.org/)
- **Tooling**: ESLint, Prettier, Husky, lint-staged, tsx, tsc-alias

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
