import { ParseOptions, ParseResult } from './parser.js';

/**
 * BUGGY CSV PARSER - DO NOT USE IN PRODUCTION
 *
 * Bugs:
 * 1. Loads entire file into memory via .toString() on buffer (no streaming).
 * 2. No maxRows validation (DoS via 1M rows).
 * 3. No cell sanitization (formula injection / XSS).
 */
export function parseCsvBuggy(csvText: string, _options: ParseOptions = {}): ParseResult {
  // Bug 1: If this were called with a Buffer, we'd do buffer.toString() loading everything into RAM.
  // For parity with the safe version we accept string, but we still split the ENTIRE text at once.
  const text = csvText; // In real buggy code: file.buffer.toString()

  // Bug 2: No BOM handling - if BOM present, first header is "\uFEFFname"
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());

  const data: Record<string, string>[] = [];

  // Bug 3: No maxRows check - will happily process millions of rows
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(','); // naive split, breaks on quoted commas
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      // Bug 4: No sanitization - formula injection and XSS possible
      row[headers[j]] = cells[j] ?? '';
    }
    data.push(row);
  }

  return { rowCount: data.length, headers, data };
}
