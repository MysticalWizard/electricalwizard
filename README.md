# ElectricalWizard Discord Bot

ElectricalWizard is a Discord bot secretary specifically built for the n-th circle of hell. This guide will help you set up and run the bot.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 18 or higher)
- [pnpm](https://pnpm.io/) (version 9 or higher)
- [MongoDB](https://www.mongodb.com/) (version 5 or higher)

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/electricalwizard.git
   cd electricalwizard
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory and add the following variables:

   ```
   BOT_TOKEN="YOUR_BOT_TOKEN"
   CLIENT_ID="YOUR_APPLICATION_ID"
   GUILD_ID="YOUR_SERVER_ID"
   OWNER_ID="YOUR_USER_ID"
   MONGODB_URI="YOUR_MONGODB_URI"
   PREFIX="!"
   STATUS="hello world!"
   ```

   Replace the placeholder values with your actual Discord bot token, application ID, server ID, your Discord user ID, and MongoDB connection URI.

4. **Set up the database**

   Ensure your MongoDB instance is running. The bot will automatically create the necessary collections when it starts.

## Running the Bot

1. **Build the project**

   ```bash
   pnpm run build
   ```

2. **Register slash commands**

   Before running the bot for the first time or after adding new commands, register the slash commands:

   ```bash
   pnpm run register
   ```

3. **Start the bot**

   For development:
   ```bash
   pnpm run dev
   ```

   For production:
   ```bash
   pnpm run pm2:start
   ```

   Alternatively, you can start the bot in watch mode, which will automatically restart when you rebuild:
   ```bash
   pnpm run pm2:watch
   ```

## Development

- Run `pnpm run lint` to check for linting errors.
- Use `pnpm run format` to automatically format the code according to the project's style guidelines.

## Additional Commands

- `pnpm run pm2:watch`: Start the bot with PM2 in watch mode.
- `pnpm run pm2:stop`: Stop the PM2 process for the bot.
- `pnpm run pm2:restart`: Restart the PM2 process for the bot.
- `pnpm run pm2:delete`: Delete the PM2 process for the bot.

## Troubleshooting

If you encounter any issues:

1. Ensure all environment variables are correctly set in the `.env` file.
2. Check that MongoDB is running and accessible.
3. Verify that your Discord bot token is valid and has the necessary permissions.
4. Make sure you've registered the slash commands after making any changes to them.

If problems persist, check the console output for error messages and refer to the Discord.js documentation or seek help in the Discord.js community.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
