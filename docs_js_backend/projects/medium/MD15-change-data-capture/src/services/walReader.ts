import type { ChangeEvent } from '../types.js';
import { query } from './db.js';

// Simulated WAL reader. In production this would read pg_logical slot.
let currentLsn = 0;

export async function getNextLsn(): Promise<number> {
  currentLsn += 1;
  return currentLsn;
}

export async function publishChange(event: ChangeEvent): Promise<void> {
  await query(
    `INSERT INTO cdc_events (lsn, table_name, operation, before_json, after_json)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      event.lsn,
      event.table,
      event.operation,
      event.before ? JSON.stringify(event.before) : null,
      event.after ? JSON.stringify(event.after) : null,
    ]
  );
}

export async function readChangesSince(lastLsn: number, limit = 100): Promise<ChangeEvent[]> {
  const result = await query(
    `SELECT lsn, table_name, operation, before_json, after_json, created_at
     FROM cdc_events
     WHERE lsn > $1
     ORDER BY lsn ASC
     LIMIT $2`,
    [lastLsn, limit]
  );

  return result.rows.map((row: any) => ({
    lsn: Number(row.lsn),
    table: row.table_name,
    operation: row.operation,
    before: row.before_json,
    after: row.after_json,
    timestamp: new Date(row.created_at).getTime(),
  }));
}

export async function getLatestLsn(): Promise<number> {
  const result = await query('SELECT COALESCE(MAX(lsn), 0) as max_lsn FROM cdc_events');
  return Number(result.rows[0].max_lsn);
}
