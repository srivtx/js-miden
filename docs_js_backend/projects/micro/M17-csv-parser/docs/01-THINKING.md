# 01-THINKING.md — CSV Parser API (M17)

## Mental Model: The Document Scanner

Imagine feeding a paper document into a scanner. A good scanner:
- Handles multiple page sizes (CSV variants).
- Removes the sticky note on the first page (BOM).
- Does not catch fire if you feed it 10,000 pages (memory limits).
- Warns you if a page contains a hidden razor blade (formula injection).

A bad scanner jams, burns down the office, or silently passes a weapon into the output tray.

## The Hot Path

Every request to `POST /upload-csv` triggers this sequence:

```
1. Extract csvText and requiredHeaders from request body
2. Reject if csvText is empty
3. Strip BOM prefix (\uFEFF) from csvText
4. Split into lines by /\r?\n/
5. Parse header line into array of cells (quote-aware)
6. Validate required headers are present
7. For each data line (skipping empty lines):
   a. Abort if data.length >= maxRows
   b. Parse line into cells (quote-aware)
   c. For each cell:
      - Truncate/check maxCellLength
      - Sanitize formula injection prefixes
   d. Build row object and push to data array
8. Return { rowCount, headers, data }
```

**The hot path is CPU-bound.** Parsing a 1,000-row CSV takes ~5-20ms in JavaScript. Memory usage scales linearly with row count and cell size.

## Danger Zones

### 1. Memory Exhaustion via Buffer Loading
If the parser reads `file.buffer.toString()` on a multipart upload, a 2GB CSV loads entirely into the Node.js heap. The default heap limit is ~1.4GB (64-bit). The process crashes with an out-of-memory error.

**Mitigation:** For this micro project, we accept raw text bodies. In production with multipart uploads, use streaming parsers (`csv-parser`, `fast-csv`) with backpressure, or enforce a strict `maxFileSize` before buffering.

### 2. DoS via Row Count
A 10M-row CSV with 3 columns creates 30M string objects. Even if each string is small, the object overhead (~40 bytes per object) consumes hundreds of megabytes. The event loop is blocked for seconds.

**Mitigation:** Enforce `maxRows` and abort parsing immediately when the limit is reached. Do not collect rows "just in case."

### 3. Formula Injection (CSV Injection / DDE)
Spreadsheet software (Excel, LibreOffice, Google Sheets) interprets cells starting with `=`, `+`, `-`, `@` as formulas. An attacker uploads:

```csv
name,command
Alice,=cmd|' /C calc'!A0
```

When an administrator opens the exported CSV in Excel, Windows Calculator launches. More dangerous payloads can execute PowerShell or download malware.

**Mitigation:** Prefix dangerous cells with a single quote (`'`). Excel displays the raw text without executing the formula.

### 4. BOM Corruption
Excel exports UTF-8 CSVs with a Byte Order Mark (`EF BB BF` = `\uFEFF`). If not stripped, the first header becomes `"\uFEFFname"` instead of `"name"`, causing all downstream validation to fail.

**Mitigation:** Strip `\uFEFF` from the start of the text before any parsing.

### 5. Quoting Ambiguity
A naive `line.split(',')` breaks on:

```csv
name,description
Alice,"She said, ""Hello"""
```

The description contains a comma inside quotes. Naive splitting produces 4 cells instead of 2.

**Mitigation:** Implement a state-machine parser that tracks `inQuotes` and handles `""` as an escaped quote.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `file.buffer.toString()` on entire upload | Stream line-by-line or enforce max file size |
| `line.split(',')` for parsing | State-machine parser respecting quotes and escapes |
| Ignore BOM | Strip `\uFEFF` before parsing |
| Return cell values raw | Sanitize `=`, `+`, `-`, `@` prefixes with `'` |
| No row limit | Enforce `maxRows` and abort early |
| No cell length limit | Enforce `maxCellLength` to prevent memory bloat |
| Accept empty CSV | Reject empty input with clear error |
| No header validation | Validate `requiredHeaders` before processing rows |

## Key Insight

> **CSV is not "just text." It is a data format with an execution environment.**
>
> Every cell you parse may become a formula in Excel, a script in a browser, or a memory bomb in your server. Treat CSV parsing like file upload handling: validate early, limit size, sanitize output, and never trust the input.

## SOURCES

- [RFC 4180 — Common Format and MIME Type for CSV Files](https://datatracker.ietf.org/doc/html/rfc4180)
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- "The Risks of CSV Injection" by George Mauer, 2017.
