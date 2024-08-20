import mongoose from 'mongoose';
import chalk from 'chalk';
import config from '@/config.js';

class DatabaseService {
  private static instance: DatabaseService;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async connect(): Promise<void> {
    try {
      await mongoose.connect(config.database.uri);
      console.log(chalk.magenta('Successfully connected to MongoDB'));
    } catch (error) {
      console.error(chalk.red('Error connecting to MongoDB:'), error);
      process.exit(1);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await mongoose.disconnect();
      console.log(chalk.yellow('Disconnected from MongoDB'));
    } catch (error) {
      console.error(chalk.red('Error disconnecting from MongoDB:'), error);
    }
  }
}

export const dbService = DatabaseService.getInstance();
