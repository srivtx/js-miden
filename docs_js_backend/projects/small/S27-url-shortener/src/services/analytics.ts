import { pool } from '../db.js';

export async function getAnalyticsForCode(shortCode: string) {
  const clicks = await pool.query('SELECT COUNT(*) FROM clicks WHERE short_code = $1', [shortCode]);
  const referrers = await pool.query(
    'SELECT referrer, COUNT(*) as count FROM clicks WHERE short_code = $1 GROUP BY referrer',
    [shortCode]
  );
  return {
    shortCode,
    totalClicks: parseInt(clicks.rows[0].count, 10),
    referrers: referrers.rows,
  };
}
