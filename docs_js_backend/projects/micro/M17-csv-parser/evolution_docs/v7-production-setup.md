# M17 CSV Parser — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
M17-csv-parser/
├── src/
│   ├── index.ts          # Express routes
│   ├── parser.ts         # Safe CSV parser
│   └── parser.buggy.ts   # Intentionally buggy (for educational comparison)
├── tests/
│   └── app.test.ts       # Vitest + supertest
├── evolution_docs/       # This documentation
├── package.json
├── tsconfig.json
└── dist/                 # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Proper CSV Parsing (Not String.split)**

```ts
function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
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
```

This handles:
- Quoted fields: `"Software Engineer, Backend"`
- Escaped quotes: `"She said ""hello"""`
- Mixed quoted/unquoted rows

**2. Formula Injection Protection**

```ts
function sanitizeCell(value: string): string {
  const dangerous = /^[=+\-@\t\r\n]/;
  if (dangerous.test(value)) {
    return "'" + value;
  }
  return value;
}
```

Prefixes dangerous cells with a single quote. Spreadsheet apps treat `'=cmd` as text, not formulas.

**3. Memory Limits**

```ts
const { maxRows = 10000, maxCellLength = 10000 } = options;
```

- `maxRows`: prevents DoS via infinite rows
- `maxCellLength`: prevents single-cell bombs
- Line-by-line processing: only the current line is in memory

**4. BOM Stripping**

```ts
function stripBOM(text: string): string {
  return text.replace(/^\uFEFF/, '');
}
```

Excel and other tools prepend UTF-8 BOM. Without stripping, the first header is `"\uFEFFname"`.

**5. Explicit Interface Contracts**

```ts
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
```

Every consumer knows exactly what the parser expects and returns.

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | Quoted commas broken, formula injection, no memory limits | Wrote naive JS |
| v2 | Type errors at runtime | Added TypeScript |
| v3 | Malicious CSV bombs, missing headers | Added validation + sanitization |
| v4 | Silent failures in production | Added structured logging |
| v5 | Regressions on every refactor | Added vitest + supertest |
| v6 | Legacy module system | Switched to ESM |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # tsx watch src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # vitest run
```
