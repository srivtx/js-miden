# M17: CSV Parser API

A micro API for uploading, parsing, and validating CSV files with security considerations for production use.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload-csv` | Accepts multipart CSV file, parses to JSON array. Validates headers and row limits. |
| GET | `/health` | Health check |

## Request

```bash
curl -X POST http://localhost:3000/upload-csv \
  -F "file=@data.csv" \
  -F "requiredHeaders=name,email,age"
```

## Response

```json
{
  "success": true,
  "rowCount": 3,
  "data": [
    { "name": "Alice", "email": "alice@example.com", "age": "30" },
    { "name": "Bob", "email": "bob@example.com", "age": "25" }
  ]
}
```

## Thinking Framework

### PHASE 1: Basic Parser
- Accept multipart file upload via `multer` (memory or disk)
- Parse CSV using a streaming or buffered approach
- Return JSON array of objects
- Validate that required headers are present

### PHASE 2: Production Hardening
- **Streaming vs Buffering**: Buffering loads the entire file into memory (`file.buffer.toString()`), which crashes on multi-GB CSVs. Streaming (line-by-line) keeps memory constant regardless of file size.
- **BOM Handling**: Excel exports UTF-8 CSVs with a Byte Order Mark (`\uFEFF`). If not stripped, the first header becomes `"\uFEFFname"` instead of `"name"`, causing validation to fail.
- **Max Row Limits**: Without a limit, a 10M row CSV causes DoS (CPU + memory). Enforce `MAX_ROWS` and abort parsing early.
- **Cell Value Sanitization**: CSV cells starting with `=`, `+`, `-`, `@` can be interpreted as formulas by spreadsheet software (CSV Formula Injection / XSS). Strip or prefix dangerous characters.
- **Max File Size**: Reject files larger than a configured limit.
- **Content-Type Validation**: Only accept `text/csv` or similar, though `multer` checks the multipart field.

### PHASE 3: Security & Edge Cases
- **Encoding**: Force UTF-8; reject unknown encodings.
- **Header Whitelisting**: Reject CSVs with unexpected headers (prevent schema pollution).
- **Empty Files**: Return 400 for empty uploads.
- **Duplicate Headers**: Decide behavior (overwrite, error, or suffix).
- **Quoting & Escapes**: Properly handle quoted fields containing commas and newlines.

## Bug

The buggy version is in `src/parser.buggy.ts`. It has **three** vulnerabilities:

1. **Memory Exhaustion**: It reads `file.buffer.toString()` — the entire file is loaded into memory. A 2GB CSV will crash the Node.js process.
2. **DoS via Row Count**: It does not validate `MAX_ROWS`. A 1M row CSV will hang the event loop and exhaust memory during object construction.
3. **Formula Injection / XSS**: It returns cell values raw. A cell like `=cmd|' /C calc'!A0` or `+1+1` will be executed when opened in Excel, and `<script>alert(1)</script>` survives as raw HTML if rendered.

## Setup

```bash
cd docs_js_backend/projects/micro/M17-csv-parser
npm install
npm run dev
```

## Tests

```bash
npm test
```
