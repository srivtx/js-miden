import type { ChangeEvent } from '../types.js';
import { query } from './db.js';
import { readChangesSince, getLatestLsn } from './walReader.js';

const consumers = new Map<string, (event: ChangeEvent) => Promise<void>>();

export function registerConsumer(
  consumerId: string,
  handler: (event: ChangeEvent) => Promise<void>
): void {
  consumers.set(consumerId, handler);
}

export async function getConsumerOffset(consumerId: string): Promise<number> {
  const result = await query(
    'SELECT last_lsn FROM cdc_offsets WHERE consumer_id = $1',
    [consumerId]
  );
  return result.rows[0]?.last_lsn ?? 0;
}

export async function setConsumerOffset(consumerId: string, lsn: number): Promise<void> {
  await query(
    `INSERT INTO cdc_offsets (consumer_id, last_lsn)
     VALUES ($1, $2)
     ON CONFLICT (consumer_id) DO UPDATE SET last_lsn = $2`,
    [consumerId, lsn]
  );
}

export async function pollAndDispatch(consumerId: string): Promise<number> {
  // BUG: Missed changes — if getConsumerOffset fails or returns stale value,
  // we skip events. But a deeper bug is in readChangesSince: if two events
  // have the same LSN (unlikely here but possible in real WAL), order breaks.

  const offset = await getConsumerOffset(consumerId);
  const events = await readChangesSince(offset);

  const handler = consumers.get(consumerId);
  if (!handler) return offset;

  // BUG: Out-of-order delivery — processing events concurrently without
  // respecting LSN order. If event N+1 finishes before N, cache is inconsistent.
  await Promise.all(
    events.map(async (event) => {
      await handler(event);
      // BUG: Updating offset per-event instead of batch means crash = reprocess.
      // But the main bug for this project is out-of-order delivery.
      await setConsumerOffset(consumerId, event.lsn);
    })
  );

  return events.length > 0 ? events[events.length - 1].lsn : offset;
}

export async function dispatchEventToAll(event: ChangeEvent): Promise<void> {
  // Used for real-time fan-out
  for (const handler of consumers.values()) {
    await handler(event);
  }
}
