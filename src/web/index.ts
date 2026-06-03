import { connectDatabase } from '@/services/database.js';
import { startWebServer } from './server.js';

async function main() {
  await connectDatabase();
  startWebServer();
}

main();
