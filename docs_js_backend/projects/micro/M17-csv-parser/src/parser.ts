export interface ParseOptions {
  requiredHeaders?: string[];
  maxRows?: number;
  maxCellLength?: number;
}

export interface ParseResult {
  rowCount: number;
  headers: string[];
  data: Record<string, string>[];
}

function stripBOM(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function sanitizeCell(value: string): string {
  // Prevent CSV formula injection
  const dangerous = /^[=+\-@\t\r\n]/;
  if (dangerous.test(value)) {
    return "'" + value;
  }
  return value;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseCsvSafe(csvText: string, options: ParseOptions = {}): ParseResult {
  const { requiredHeaders = [], maxRows = 10000, maxCellLength = 10000 } = options;

  if (!csvText || csvText.trim().length === 0) {
    throw new Error('CSV text is empty');
  }

  const cleanText = stripBOM(csvText);
  const lines = cleanText.split(/\r?\n/);

  if (lines.length === 0) {
    throw new Error('CSV has no lines');
  }

  const headers = parseLine(lines[0]).map((h) => h.trim());

  for (const h of requiredHeaders) {
    if (!headers.includes(h.trim())) {
      throw new Error(`Missing required header: ${h}`);
    }
  }

  const data: Record<string, string>[] = [];

  // We stream line-by-line; only the current line is in memory
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;

    if (data.length >= maxRows) {
      throw new Error(`Row count exceeds maximum allowed (${maxRows})`);
    }

    const cells = parseLine(line);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      let cell = cells[j] ?? '';
      if (cell.length > maxCellLength) {
        throw new Error(`Cell exceeds maximum length at row ${i}, column ${headers[j]}`);
      }
      cell = sanitizeCell(cell);
      row[headers[j]] = cell;
    }

    data.push(row);
  }

  return { rowCount: data.length, headers, data };
}
