# 04-OLD-VS-NEW.md — CSV Parser API (M17)

## Old Patterns (2015–2020)

### 1. `file.buffer.toString()` — Loading Everything into Memory

**WHAT:** Reading a multipart upload's buffer into a single string without size limits.

```javascript
// 2016-era code (WRONG)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload-csv', upload.single('file'), (req, res) => {
  const text = req.file.buffer.toString(); // DANGER
  const lines = text.split('\n');
  // ... parse ...
});
```

**WHY it was common:** It is the simplest way to handle multipart uploads. Many Express + Multer tutorials from 2015–2018 used `memoryStorage()` without mentioning limits.

**WRONG today:**
- A 2GB CSV will crash Node.js with `FATAL ERROR: Reached heap limit`.
- No backpressure: the client can upload as fast as the network allows, overwhelming the server.
- No validation of file type or size before processing.

---

### 2. Naive `split(',')` Parsing

**WHAT:** Using `String.prototype.split(',')` to break CSV lines into fields.

```javascript
// 2015-era code (WRONG)
const lines = text.split('\n');
const headers = lines[0].split(',');
const data = lines.slice(1).map(line => {
  const cells = line.split(','); // Breaks on quoted commas!
  const row = {};
  headers.forEach((h, i) => row[h] = cells[i]);
  return row;
});
```

**WHY it was common:** `split(',')` works for the simplest CSVs (no commas in cells, no quotes). Many developers never encountered edge cases during prototyping.

**WRONG today:**
- Breaks on: `Alice,"She said, hello",30` → produces 4 cells instead of 3.
- Breaks on escaped quotes: `Bob,"He said ""wow""",25` → produces garbage.
- Breaks on newlines in quoted fields: multiline records are impossible.
- Every real-world CSV from Excel or a database uses quotes.

---

### 3. No Formula Injection Protection

**WHAT:** Returning cell values exactly as they appear in the CSV.

```javascript
// 2017-era code (WRONG)
row[header] = cells[i]; // Raw value, no sanitization
```

**WHY it was common:** Developers did not know that spreadsheet software executes formulas from CSV cells. It felt like "just text."

**WRONG today:**
- `=cmd|' /C calc'!A0` in a cell executes Windows Calculator when opened in Excel.
- PowerShell payloads can download and execute malware.
- XSS vectors like `<script>alert(1)</script>` survive if the parsed data is rendered as HTML.

---

### 4. Ignoring BOM

**WHAT:** Treating the BOM as part of the first header name.

```javascript
// 2015-era code (WRONG)
const headers = lines[0].split(','); // "\uFEFFname" instead of "name"
```

**WHY it was common:** Most developers never encountered BOMs because their test CSVs were hand-written in text editors that do not add BOMs. Only Excel-exported files have this problem.

**WRONG today:**
- Header validation fails silently: `"\uFEFFname" !== "name"`.
- Users blame the application, not Excel.

---

## Modern Patterns (2020+)

### 1. Enforced Size Limits + Streaming

**WHAT:** Using `maxFileSize`, `maxRows`, and streaming parsers for large files.

```typescript
// 2025 code (RIGHT)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 10000;

// With multer:
const upload = multer({
  limits: { fileSize: MAX_FILE_SIZE },
  storage: multer.memoryStorage(), // For small files only
});

// Or true streaming:
import { parse } from 'csv-parse';
createReadStream('huge.csv')
  .pipe(parse({ columns: true }))
  .on('data', (row) => {
    if (++count > MAX_ROWS) {
      parser.destroy();
      return reject(new Error('Too many rows'));
    }
    // process row
  });
```

**WHY it is right:**
- Limits prevent memory exhaustion.
- Streaming keeps memory flat for arbitrarily large files.
- Early abort on `maxRows` prevents wasted CPU.

---

### 2. RFC 4180 State-Machine Parser

**WHAT:** Implementing a quote-aware parser that tracks `inQuotes` state.

```typescript
// 2025 code (RIGHT)
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
```

**WHY it is right:**
- Handles quoted commas correctly.
- Handles `""` escape sequences correctly.
- Follows RFC 4180 exactly.
- No dependencies.

---

### 3. Formula Injection Sanitization

**WHAT:** Prefixing dangerous cell values with `'` to neutralize spreadsheet formula execution.

```typescript
// 2025 code (RIGHT)
function sanitizeCell(value: string): string {
  const dangerous = /^[=+\-@\t\r\n]/;
  if (dangerous.test(value)) {
    return "'" + value;
  }
  return value;
}
```

**WHY it is right:**
- Non-destructive: data is preserved.
- Excel and LibreOffice display the literal text.
- Covers all four dangerous prefixes: `=`, `+`, `-`, `@`.

---

### 4. BOM Stripping

**WHAT:** Removing the UTF-8 BOM (`\uFEFF`) before any parsing.

```typescript
// 2025 code (RIGHT)
function stripBOM(text: string): string {
  return text.replace(/^\uFEFF/, '');
}
```

**WHY it is right:**
- One-line fix.
- Prevents header corruption.
- Compatible with Excel-exported files.

---

## Comparison Table

| Era | Memory | Parser | Formula Protection | BOM Handling |
|-----|--------|--------|-------------------|--------------|
| 2010 | `file.buffer.toString()` | `split(',')` | None | Ignored |
| 2015 | `file.buffer.toString()` | `split(',')` | None | Ignored |
| 2017 | `file.buffer.toString()` | Regex or `split(',')` | None | Sometimes stripped |
| 2020 | Size limits + streaming | State machine or library | Prefix with `'` | Stripped |
| 2025 | Streaming + strict limits | RFC 4180 state machine | Prefix with `'` + XSS escape | Stripped + encoding validation |

## WRONG vs RIGHT

| WRONG (Old) | RIGHT (Modern) |
|-------------|----------------|
| `file.buffer.toString()` without limits | Enforce `maxFileSize`, `maxRows`, stream large files |
| `line.split(',')` | RFC 4180 state-machine parser |
| Return raw cell values | Prefix `=`, `+`, `-`, `@` with `'` |
| Ignore BOM | Strip `\uFEFF` before parsing |
| No row limit | Abort early at `maxRows` |
| No cell length limit | Enforce `maxCellLength` |

## SOURCES

- [RFC 4180 — Common Format and MIME Type for CSV Files](https://datatracker.ietf.org/doc/html/rfc4180)
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- "The Risks of CSV Injection" by George Mauer, 2017.
- Node.js docs, `Buffer` and `stream` modules.
