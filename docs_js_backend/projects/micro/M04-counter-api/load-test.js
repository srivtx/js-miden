// Load test to prove the race condition in the buggy counter implementation
// Prerequisites: Server running, Redis is up, and counter is at 0
// Tip: Run `redis-cli FLUSHDB` before this script to ensure a clean state

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TOTAL_REQUESTS = 1000;

async function getCount() {
  const res = await fetch(`${BASE_URL}/count`);
  if (!res.ok) throw new Error(`GET /count failed: ${res.status}`);
  return (await res.json()).count;
}

async function sendIncrement() {
  const res = await fetch(`${BASE_URL}/increment`, { method: 'POST' });
  if (!res.ok) throw new Error(`POST /increment failed: ${res.status}`);
  return res.json();
}

async function run() {
  const startCount = await getCount();
  console.log(`Starting count: ${startCount}`);
  console.log(`Firing ${TOTAL_REQUESTS} concurrent POST /increment requests...\n`);

  const promises = Array.from({ length: TOTAL_REQUESTS }, () => sendIncrement());

  try {
    await Promise.all(promises);
  } catch (err) {
    console.error('Request failed:', err.message);
    process.exit(1);
  }

  const finalCount = await getCount();
  const expected = startCount + TOTAL_REQUESTS;
  const lost = expected - finalCount;

  console.log('Results:');
  console.log(`  Expected count:  ${expected}`);
  console.log(`  Actual count:    ${finalCount}`);
  console.log(`  Lost increments: ${lost}`);
  console.log(`  Race condition proven: ${lost > 0 ? 'YES' : 'NO'}`);

  if (lost > 0) {
    console.log('\nThe bug is proven: read-modify-write loses increments under concurrency.');
    process.exit(1);
  }
}

run().catch(console.error);
