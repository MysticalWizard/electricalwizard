import config from '@/config.js';

export const validFileExtension =
  config.bot.env === 'production' ? '.js' : '.ts';
