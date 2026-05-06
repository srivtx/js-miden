import 'dotenv/config';
import app from './app.js';
import { initDb } from './db.js';

const PORT = process.env.PORT || 3000;

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`S14 Search API listening on port ${PORT}`);
  });
}

main().catch(console.error);
