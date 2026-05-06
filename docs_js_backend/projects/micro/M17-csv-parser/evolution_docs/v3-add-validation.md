# M17 CSV Parser — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Your TypeScript parser accepts any CSV string. Attackers and buggy clients exploit this:

```csv
# Formula injection attack
name,phone
Alice,=cmd|(' /C calc')!A0
Bob,+1-234-567-8900

# Missing required header
name,age
Alice,30

# 1 million rows (DoS)
name
Alice
Alice
... (999,999 more)

# BOM corruption
name,email
Alice,alice@example.com
```

Without validation:
- Formula cells execute in Excel/Google Sheets
- Missing headers crash downstream code
- Unlimited rows exhaust memory
- BOM makes header matching fail silently

## The Fix: Multi-layer Validation

```ts
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

export function parseCsvSafe(csvText: string, options: ParseOptions = {}): ParseResult {
  const { requiredHeaders = [], maxRows = 10000, maxCellLength = 10000 } = options;

  if (!csvText || csvText.trim().length === 0) {
    throw new Error('CSV text is empty');
  }

  const cleanText = stripBOM(csvText);
  const lines = cleanText.split(/\r?\n/);

  const headers = parseLine(lines[0]).map((h) => h.trim());

  // Validate required headers exist
  for (const h of requiredHeaders) {
    if (!headers.includes(h.trim())) {
      throw new Error(`Missing required header: ${h}`);
    }
  }

  const data: Record<string, string>[] = [];

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
```

**What validation prevents:**
- **Formula injection:** `=cmd` becomes `'=cmd` — neutralized in spreadsheet apps
- **Missing headers:** Explicit error instead of downstream `undefined` crash
- **Memory exhaustion:** `maxRows` and `maxCellLength` enforce bounds
- **BOM corruption:** Stripped before parsing

## The Pain That Remains

A user reports: *"My CSV upload fails with 'CSV text is empty' but I'm definitely sending data."* You check your logs... you have none. You can't see what the server received. You can't reproduce locally because the user's client sends a different content type.

## What v4 Fixes

Logging. Debug production failures without guessing.
