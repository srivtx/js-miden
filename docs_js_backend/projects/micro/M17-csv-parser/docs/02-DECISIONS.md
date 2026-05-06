# 02-DECISIONS.md — CSV Parser API (M17)

## 1. Buffered vs Streaming Parsing

### WHAT

| Approach | Memory Profile | Complexity | Best For |
|----------|---------------|------------|----------|
| **Buffered (load all)** | O(file size) — entire file in RAM | Very low | Small files (<10MB) |
| **Line-by-line (chunked)** | O(line size) — one line at a time | Low | Medium files, simple formats |
| **True streaming (Transform)** | O(buffer size) — backpressure aware | Medium | Large files, production pipelines |
| **External library** | O(buffer size) | Low (for user) | Most production cases |

### WHY

For a micro project, true streaming with Node.js `Transform` streams adds boilerplate (`pipe`, `on('data')`, backpressure handling) that distracts from the core concepts (RFC 4180, BOM, formula injection).

However, `file.buffer.toString()` — loading an entire multi-GB file into a single string — is a critical vulnerability. The Node.js heap limit is ~1.4GB by default. A 2GB CSV will crash the process with `FATAL ERROR: Reached heap limit`.

### DECISION

Use a **line-by-line buffered approach**: split the text into lines, then iterate. This keeps memory usage proportional to the largest line rather than the entire file. For this micro project, we accept raw text in the request body (not multipart), so the HTTP server itself limits the body size. In production with multipart uploads, enforce `maxFileSize` before any parsing.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `file.buffer.toString()` on a multipart upload without size limits | Enforce `maxFileSize` before buffering |
| Load entire file into one string, then parse | Split line-by-line; only one line in memory at a time |
| No memory limit at all | Configure `maxRows`, `maxCellLength`, and `maxFileSize` |

---

## 2. Formula Injection Sanitization Strategy

### WHAT

| Strategy | Mechanism | User Experience | Security |
|----------|-----------|-----------------|----------|
| **Prefix with `'`** | `'=cmd|...` | Excel displays raw text | Prevents execution |
| **Strip dangerous prefix** | Remove `=`, `+`, `-`, `@` | Data loss | Prevents execution but mutates data |
| **Reject entire file** | Return 400 if any cell has dangerous prefix | Secure but harsh | Blocks legitimate data |
| **Warn only** | Log warning, return raw | Seamless | Insecure — user still at risk |

### WHY

Prefixing with `'` is the industry-standard mitigation. Excel and LibreOffice display the cell as literal text (the `'` is not visible in the cell content, only in the formula bar). The data is preserved; the attack is neutralized.

Stripping prefixes mutates user data. A legitimate cell like `+1-555-1234` becomes `1-555-1234` — data loss.

Rejecting the entire file is secure but user-hostile. A single bad cell in a 10,000-row upload should not block the entire import.

### DECISION

**Prefix dangerous cells with `'`**. This is non-destructive, widely supported by spreadsheet software, and simple to implement.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Return raw cell values | Prefix `=`, `+`, `-`, `@` with `'` |
| Strip dangerous characters (data loss) | Prefix to preserve data while neutralizing formulas |
| Only check `=` (misses `+`, `-`, `@`) | Check all four dangerous prefixes |
| Ignore formula injection entirely | Sanitize every cell during parse |

---

## 3. Quote-Aware Parsing vs Naive Split

### WHAT

| Approach | Code | Handles `",\"` | Handles `\"\"` | Handles newlines in quotes |
|----------|------|--------------|--------------|---------------------------|
| **Naive split** | `line.split(',')` | No | No | No |
| **State machine** | Track `inQuotes` flag | Yes | Yes | Yes (if multiline supported) |
| **Regex** | Complex regex | Sometimes | Sometimes | Rarely |
| **Library (csv-parse)** | Battle-tested | Yes | Yes | Yes |

### WHY

RFC 4180 specifies:
- Fields may be enclosed in double quotes.
- Commas inside quoted fields are not delimiters.
- A double quote inside a quoted field is escaped by doubling it: `""`.
- A quoted field may contain line breaks (multiline records).

A naive `split(',')` breaks immediately on any real-world CSV exported from Excel or a database.

### DECISION

Implement a **state-machine parser** that tracks `inQuotes` and handles `""` escape sequences. This teaches the RFC 4180 rules without adding a dependency. For production, use `csv-parse` or `papaparse`.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `line.split(',')` | State-machine parser with `inQuotes` flag |
| Ignore RFC 4180 | Follow RFC 4180 for quotes, escapes, and delimiters |
| Assume no commas in cells | Handle quoted commas correctly |
| Assume no quotes in cells | Handle `""` escape sequences |

## SOURCES

- [RFC 4180 — Common Format and MIME Type for CSV Files](https://datatracker.ietf.org/doc/html/rfc4180)
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- "The Risks of CSV Injection" by George Mauer, 2017.
