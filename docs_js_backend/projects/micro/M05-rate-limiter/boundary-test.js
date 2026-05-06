/**
 * Boundary Burst Test
 *
 * This test demonstrates the fixed-window bug.
 * By sending 10 requests just before a window boundary and 10 just after,
 * we can get 20 requests through in ~1 second instead of the intended 10/minute.
 *
 * Usage:
 *   1. Start Redis: docker compose up -d
 *   2. Start server: npm run dev
 *   3. Run test: node boundary-test.js
 */

import http from 'node:http';

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://${HOST}:${PORT}`;

function makeRequest() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/api/data`, (res) => {
      res.resume();
      resolve({
        status: res.statusCode,
        remaining: res.headers['x-ratelimit-remaining'],
        retryAfter: res.headers['retry-after'],
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function burstRequests(count, label) {
  console.log(`  Sending ${count} requests (${label})...`);
  const results = [];
  for (let i = 0; i < count; i++) {
    const result = await makeRequest();
    results.push(result);
  }
  const success = results.filter((r) => r.status === 200).length;
  const blocked = results.filter((r) => r.status === 429).length;
  console.log(`    Success: ${success}, Blocked: ${blocked}`);
  return { success, blocked };
}

async function main() {
  console.log('=== Boundary Burst Test ===');
  console.log('This test demonstrates the fixed-window bug.\n');

  const isRunning = await checkServer();
  if (!isRunning) {
    console.error('Server is not running. Start it first:');
    console.error('  docker compose up -d');
    console.error('  npm run dev');
    process.exit(1);
  }

  const windowMs = 60000; // 1 minute
  const now = Date.now();
  const nextWindow = Math.ceil(now / windowMs) * windowMs;
  const waitMs = nextWindow - now;

  console.log(`Current time: ${new Date(now).toISOString()}`);
  console.log(`Next window boundary: ${new Date(nextWindow).toISOString()}`);
  console.log(`Waiting ${waitMs}ms for boundary...\n`);

  if (waitMs > 1000) {
    await sleep(waitMs - 1000);
  }

  // Burst 1: Just before the boundary
  const before = await burstRequests(10, 'before boundary');

  // Wait to cross the boundary
  const remaining = nextWindow - Date.now();
  if (remaining > 0) {
    console.log(`  Waiting ${remaining + 100}ms to cross boundary...`);
    await sleep(remaining + 100);
  }

  // Burst 2: Just after the boundary
  const after = await burstRequests(10, 'after boundary');

  const totalSuccess = before.success + after.success;
  console.log(`\n=== RESULTS ===`);
  console.log(`Total requests: 20`);
  console.log(`Allowed through: ${totalSuccess}`);
  console.log(`Expected (true sliding window): ~10`);
  console.log(
    `Bug present: ${totalSuccess > 10 ? 'YES - Fixed window allows burst attack!' : 'NO'}`
  );

  process.exit(totalSuccess > 10 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
