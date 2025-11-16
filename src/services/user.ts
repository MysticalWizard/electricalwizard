import UserModel, { IUser } from '@/models/User.js';

export class UserService {
  /**
   * Find or create a user by their Discord ID
   */
  static async findOrCreateUser(
    userId: string,
    username: string,
  ): Promise<IUser> {
    const user = await UserModel.findOneAndUpdate(
      { userId },
      { username },
      { upsert: true, new: true },
    );

    return user;
  }

  /**
   * Update user information
   */
  static async updateUser(
    userId: string,
    username: string,
    updates: Partial<IUser>,
  ): Promise<IUser | null> {
    return await UserModel.findOneAndUpdate(
      { userId },
      { username, ...updates },
      { upsert: true, new: true },
    );
  }

  /**
   * Get a user by their Discord ID
   */
  static async getUserById(userId: string): Promise<IUser | null> {
    return await UserModel.findOne({ userId });
  }
}
