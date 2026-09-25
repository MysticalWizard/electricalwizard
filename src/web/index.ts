import { watchChangeFeed } from '#/services/changeFeed.js';
import { connectDatabase } from '#/services/database.js';
import { startWebServer } from './server.js';
import { emitDbChange } from './utils/eventBus.js';
import { registryKeyFor } from './utils/models.js';

async function main() {
  await connectDatabase();
  startWebServer();

  // Forward writes from both processes to dashboard clients.
  void watchChangeFeed((entry) => {
    const key = registryKeyFor(entry.model);
    if (key) emitDbChange(key, entry.action, entry.id);
  });
}

main();
