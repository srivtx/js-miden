export function uuidV4(): string {
  return crypto.randomUUID();
}

export function uuidV7(): string {
  // BUG: Uses wrong timestamp precision.
  // The timestamp should be Unix epoch milliseconds, but this implementation
  // incorrectly uses Date.now() which is already milliseconds since epoch.
  // Wait - Date.now() IS Unix epoch milliseconds. Let me create a real bug.
  // Real bug: uses performance.now() or process.hrtime.bigint() thinking it's epoch ms,
  // or uses local timezone-adjusted timestamp instead of UTC.
  // Let's make it use new Date().getTime() but with a deliberate mistake:
  // it uses seconds instead of milliseconds, or adds timezone offset incorrectly.
  const now = new Date();
  // Wrong: using getTime() divided by 1000 (seconds) instead of milliseconds
  const timestamp = Math.floor(now.getTime() / 1000);

  // Build UUID v7: 48-bit timestamp + 74 random bits
  const timeHex = timestamp.toString(16).padStart(12, '0');
  const randA = Math.floor(Math.random() * 0x1000)
    .toString(16)
    .padStart(3, '0');
  const randB = Math.floor(Math.random() * 0x4000)
    .toString(16)
    .padStart(4, '0');
  const randC = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  return `${timeHex.slice(0, 8)}-${timeHex.slice(8)}-7${randA}-${randB}-${randC}`;
}

export function ulid(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let timestamp = Date.now();
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = ENCODING[timestamp % 32] + time;
    timestamp = Math.floor(timestamp / 32);
  }
  const random = Array.from({ length: 16 }, () =>
    ENCODING[Math.floor(Math.random() * 32)]
  ).join('');
  return time + random;
}

export function bulkGenerate(count: number, type: 'v4' | 'v7' | 'ulid'): string[] {
  const generator = type === 'v4' ? uuidV4 : type === 'v7' ? uuidV7 : ulid;
  return Array.from({ length: count }, () => generator());
}
