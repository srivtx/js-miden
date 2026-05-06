# 08-CRITIQUE.md — CSV Parser API (M17)

## Senior Engineer Review

### Overall Assessment

This is a **well-structured teaching project** that covers the most dangerous CSV parsing pitfalls: memory exhaustion, formula injection, and BOM corruption. The state-machine parser is clean, the formula sanitization is correct, and the tests cover edge cases. However, the "line-by-line" approach is still a full-buffer parse, and production deployments need true streaming.

### Strengths

1. **RFC 4180 State-Machine Parser**
   ```typescript
   for (let i = 0; i < line.length; i++) {
     const char = line[i];
     if (char === '"') {
       if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
       else { inQuotes = !inQuotes; }
     } else if (char === ',' && !inQuotes) {
       result.push(current); current = '';
     } else { current += char; }
   }
   ```
   This is a correct, dependency-free implementation of RFC 4180 quote handling. It handles commas in quotes and `""` escapes.

2. **Formula Injection Sanitization**
   ```typescript
   function sanitizeCell(value: string): string {
     const dangerous = /^[=+\-@\t\r\n]/;
     if (dangerous.test(value)) return "'" + value;
     return value;
   }
   ```
   Prefixing with `'` is the industry-standard mitigation. It is non-destructive and effective.

3. **BOM Stripping**
   ```typescript
   function stripBOM(text: string): string {
     return text.replace(/^\uFEFF/, '');
   }
   ```
   Simple, correct, and essential for Excel compatibility.

4. **Row Limit Enforcement**
   Early abort at `maxRows` prevents DoS via row count. This is often forgotten in CSV parsers.

### Weaknesses

1. **Not Actually Streaming**
   ```typescript
   const lines = cleanText.split(/\r?\n/);
   ```
   While the code iterates line-by-line, `String.prototype.split()` loads all lines into an array simultaneously. A 10M-line CSV creates a 10M-element array before parsing begins. **True streaming** uses a `ReadableStream` or `Transform` stream to process one line at a time without holding all lines in memory.

2. **No Multiline Record Support**
   RFC 4180 allows line breaks inside quoted fields:
   ```csv
   name,description
   Alice,"She said
   hello"
   ```
   The current `split(/\r?\n/)` breaks this into two lines, corrupting the record.

3. **No Cell Length Limit in Tests**
   While `maxCellLength` is defined in the interface, the tests do not verify it. A missing test is a missing contract.

4. **No Duplicate Header Handling**
   If a CSV has two columns named `name`, the second overwrites the first in the row object. This is silent data loss.

5. **Type Coercion Ignored**
   All values remain strings. For a reporting API, users often expect `age` to be a number. However, automatic type coercion is dangerous (`"00123"` becomes `123`; `"false"` becomes `false`). This is a design trade-off, not a bug, but it should be documented.

### Code Smells

| Smell | Location | Severity |
|-------|----------|----------|
| `split(/\r?\n/)` loads all lines | `parser.ts` | High — not truly streaming |
| No multiline quoted field support | `parser.ts` | Medium — RFC 4180 violation |
| No `maxCellLength` test | `app.test.ts` | Low — missing coverage |
| Duplicate headers overwrite silently | `parser.ts` | Medium — data loss |
| Raw text body instead of multipart | `index.ts` | Low — acceptable for micro project |

### What Would Make This Production-Grade

1. **True streaming parser** using `csv-parse` with `ReadableStream`:
   ```typescript
   import { parse } from "csv-parse";
   createReadStream(file.path)
     .pipe(parse({ columns: true }))
     .on("data", (row) => { /* process */ })
     .on("end", () => { /* done */ });
   ```
2. **Multiline record support** by tracking `inQuotes` across line boundaries.
3. **Duplicate header handling** — suffix duplicates (`name`, `name_2`) or reject the file.
4. **Schema validation** with explicit type coercion rules (opt-in, not automatic).
5. **Multipart upload** via `multer` with `limits: { fileSize: MAX_FILE_SIZE }`.
6. **Async processing queue** for large files — return a job ID immediately, process in background.

### Final Verdict

> **A- as a teaching project. C+ as production code.**
>
> The security mitigations (BOM, formula injection, row limits) are excellent. To deploy, replace the buffered split with a true streaming parser and add multiline record support.

## WRONG vs RIGHT

| Wrong (Current) | Right (Production) |
|-----------------|--------------------|
| `text.split(/\r?\n/)` | True streaming parser (`csv-parse` with streams) |
| No multiline support | Track `inQuotes` across line boundaries |
| Silent duplicate header overwrite | Suffix duplicates or reject file |
| Raw text body | Multipart upload with size limits |
| Synchronous parsing for large files | Async job queue with progress tracking |

## SOURCES

- [RFC 4180 — Common Format and MIME Type for CSV Files](https://datatracker.ietf.org/doc/html/rfc4180)
- `csv-parse` documentation, v5, 2024.
- Author's own review based on 10+ years of building data ingestion pipelines.
