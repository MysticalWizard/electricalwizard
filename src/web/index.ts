import { watchChangeFeed } from '#/services/changeFeed.js';
import { connectDatabase } from '#/services/database.js';
import { startWebServer } from './server.js';
import { emitDbChange } from './utils/eventBus.js';
import { registryKeyFor } from './utils/models.js';

// Models outside the registry whose changes the dashboard still shows live.
// `translations` refreshes the ['analytics', 'translations'] query.
const EXTRA_KEYS: Record<string, string> = {
  TranslationCount: 'translations',
};

async function main() {
  await connectDatabase();
  startWebServer();

  // Forward writes from both processes to dashboard clients.
  void watchChangeFeed((entry) => {
    const key = registryKeyFor(entry.model) ?? EXTRA_KEYS[entry.model];
    if (key) emitDbChange(key, entry.action, entry.id, entry.userIds);
  });
}

main();
