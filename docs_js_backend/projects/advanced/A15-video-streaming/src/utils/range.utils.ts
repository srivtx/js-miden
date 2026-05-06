import { Range } from '../types/stream.types.js';

/**
 * Parse HTTP Range header value.
 * BUG: No validation against actual file size, allowing arbitrary ranges.
 */
export function parseRange(rangeHeader: string, fileSize: number): Range | null {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const parts = rangeHeader.replace('bytes=', '').split('-');
  if (parts.length !== 2) {
    return null;
  }

  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  // BUG: Missing validation for:
  // - NaN values
  // - start > end
  // - start or end exceeding fileSize
  // - Negative values
  // - Range size limits (can request entire file or more)

  return { start, end };
}
