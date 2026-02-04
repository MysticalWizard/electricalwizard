import chalk from 'chalk';
import mongoose from 'mongoose';
import { config } from '../config.js';

export async function connectDatabase(): Promise<typeof mongoose> {
  const connection = await mongoose.connect(config.mongoUri);
  console.log(
    chalk.green(`✓ Connected to MongoDB: ${connection.connection.host}`),
  );
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log(chalk.yellow('✗ Disconnected from MongoDB'));
}
