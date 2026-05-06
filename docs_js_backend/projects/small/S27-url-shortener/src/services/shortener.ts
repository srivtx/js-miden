import { pool } from './db.js';

let counter = 0;
const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function encode(num: number): string {
  let result = '';
  let n = num;
  do {
    result = chars[n % chars.length] + result;
    n = Math.floor(n / chars.length);
  } while (n > 0);
  return result || 'a';
}

// BUG: sequential short codes instead of random
export async function createShortCode(url: string, customCode?: string, expiresInDays?: number): Promise<string> {
  const shortCode = customCode || encode(++counter);
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

  try {
    await pool.query(
      'INSERT INTO urls (short_code, url, expires_at) VALUES ($1, $2, $3)',
      [shortCode, url, expiresAt]
    );
  } catch (err: any) {
    if (err.code === '23505') throw new Error('Collision: short code already exists');
    throw err;
  }

  return shortCode;
}

export async function getUrlByShortCode(shortCode: string) {
  const result = await pool.query('SELECT * FROM urls WHERE short_code = $1', [shortCode]);
  return result.rows[0] || null;
}

export async function recordClick(shortCode: string, referrer?: string, ip?: string) {
  await pool.query('INSERT INTO clicks (short_code, referrer, ip) VALUES ($1, $2, $3)', [shortCode, referrer || null, ip || null]);
}
