import { Client } from 'discord.js';
import ReminderModel from '@/models/Reminder.js';

class ReminderService {
  private client: Client | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // Check every minute

  initialize(client: Client) {
    this.client = client;
    this.startReminderCheck();
    console.log('Reminder service initialized');
  }

  private startReminderCheck() {
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, this.CHECK_INTERVAL);
  }

  private async checkReminders() {
    if (!this.client) return;

    try {
      const now = new Date();
      const dueReminders = await ReminderModel.find({
        reminderTime: { $lte: now },
        isCompleted: false,
      });

      for (const reminder of dueReminders) {
        try {
          if (reminder.isPrivate) {
            // Send as DM
            const user = await this.client.users.fetch(reminder.userId);
            await user.send(`Reminder: ${reminder.message}`);
          } else {
            // Send in channel
            const channel = await this.client.channels.fetch(
              reminder.channelId,
            );
            if (channel && 'send' in channel) {
              await channel.send(
                `<@${reminder.userId}> Reminder: ${reminder.message}`,
              );
            }
          }

          reminder.isCompleted = true;
          await reminder.save();
        } catch (error) {
          console.error(`Failed to send reminder ${reminder._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const reminderService = new ReminderService();
