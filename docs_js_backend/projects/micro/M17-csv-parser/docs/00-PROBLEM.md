# 00-PROBLEM.md — CSV Parser API (M17)

## WHAT

Build an HTTP API that:

1. **POST /upload-csv** — Accepts raw CSV text (or multipart file), parses it to a JSON array, validates headers, and enforces row limits.
2. **GET /health** — Returns a health check.
3. **Handles RFC 4180 CSV rules** — quoted fields, escaped quotes, commas inside quotes, CRLF vs LF.
4. **Strips UTF-8 BOM** — Excel-exported CSVs start with `\uFEFF`; the parser must remove it before header validation.
5. **Sanitizes formula injection** — Cells starting with `=`, `+`, `-`, `@` are prefixed with `'` to prevent spreadsheet formula execution.
6. **Enforces `maxRows`** — Abort parsing early if row count exceeds the limit to prevent DoS.

The parser must be memory-safe: it must not load multi-gigabyte files into a single buffer, and it must handle edge cases like empty files, missing headers, and duplicate columns.

## WHY

CSV is the lingua franca of data exchange. Every SaaS product exports and imports CSV:

- **User imports**: Bulk-uploading contacts, products, or employees.
- **Reporting**: Exporting analytics dashboards for Excel analysis.
- **Integrations**: ETL pipelines consuming vendor dumps.

Without proper parsing, a CSV endpoint becomes a weapon:

- **Memory exhaustion**: A 2GB CSV loaded into `file.buffer.toString()` crashes the Node.js process.
- **DoS via row count**: A 10M-row CSV hangs the event loop and exhausts heap memory during object construction.
- **Formula injection / XSS**: A cell like `=cmd|' /C calc'!A0` executes commands when opened in Excel. A cell like `<script>alert(1)</script>` renders raw HTML if the parsed data is later displayed in a web UI.

Real breaches have occurred where attackers uploaded malicious CSVs to SaaS platforms, triggering remote code execution on administrators' machines when they opened the exported reports.

## CONSTRAINTS

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max rows | 10,000 (configurable) | Prevents DoS via row count |
| Max cell length | 10,000 chars | Prevents memory bloat from a single giant cell |
| Encoding | UTF-8 | Industry standard; reject unknown encodings |
| BOM handling | Strip `\uFEFF` prefix | Excel compatibility |
| Formula prefix | `'` before `=`, `+`, `-`, `@` | Neutralizes CSV formula injection |
| Empty files | Rejected with `400` | No meaningful parse possible |

## SCOPE

### In Scope
- Line-by-line CSV parsing (buffered, not true streaming for this micro project).
- Quote-aware field splitting (`"a,b"` is one cell).
- Header validation against `requiredHeaders`.
- BOM stripping and cell sanitization.
- Row limit enforcement with early abort.

### Out of Scope
- True streaming with backpressure (e.g., Node.js `Transform` streams).
- Multipart file upload via `multer` (conceptually discussed but raw text body is used for simplicity).
- Schema type coercion (all values remain strings).
- Duplicate header handling beyond basic parsing.
- CSV output generation (only parsing).

## ACCEPTANCE CRITERIA

1. Simple CSV parses correctly: `name,email\nAlice,alice@example.com` returns `rowCount: 1`.
2. Missing required header returns `400` with "Missing required header".
3. BOM-prefixed CSV has first header parsed as `"name"`, not `"\uFEFFname"`.
4. Formula cells are sanitized: `=cmd|…` becomes `'=cmd|…`.
5. Row count exceeding `maxRows` returns `400` with "Row count exceeds maximum".
6. Empty CSV returns `400`.

## SOURCES

- [RFC 4180 — Common Format and MIME Type for CSV Files](https://datatracker.ietf.org/doc/html/rfc4180)
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- [Microsoft Excel: Security Considerations for External Data](https://support.microsoft.com/en-us/office/security-considerations-for-external-data)
- Node.js docs, `Buffer` and `string` handling.
