# M17 CSV Parser — v1 Simple JS

## The Naive Implementation

You need to parse CSV uploaded by users. Simple:

```js
// parser.js
function parseCsv(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] || '';
    }
    data.push(row);
  }

  return { rowCount: data.length, headers, data };
}

// app.js
app.post('/upload-csv', (req, res) => {
  const result = parseCsv(req.body.csv);
  res.json({ success: true, ...result });
});
```

Works locally:
```bash
curl -X POST http://localhost:3000/upload-csv \
  -H "Content-Type: application/json" \
  -d '{"csv":"name,email\nAlice,alice@example.com"}'
# → { "success": true, "rowCount": 1, "headers": ["name","email"], "data": [...] }
```

## The Pain in Production

### 1. Quoted Commas Break Parsing

```csv
name,description
Alice,"Software Engineer, Backend"
```

Your naive `split(',')` produces 3 cells: `["Alice", "\"Software Engineer", " Backend\""]`. The row is corrupted.

### 2. Formula Injection / XSS

```csv
name,formula
Alice,=cmd|(' /C calc')!A0
```

When this CSV is opened in Excel, it executes commands. When rendered in HTML, `=cmd` is harmless, but `+1-234-567-8900` auto-dials in some clients. Formula injection is a real attack vector.

### 3. No Memory Limits

```bash
curl -X POST http://localhost:3000/upload-csv \
  -d '{"csv":"name\n'$(python3 -c 'print("A\n"*1000000)')'"}'
```

1 million rows. Your server loads the entire string, splits it into an array of 1 million strings, then creates 1 million objects. Node.js runs out of heap memory and crashes.

### 4. No BOM Handling

A user exports CSV from Excel. It starts with a UTF-8 BOM (`\uFEFF`). Your parser sees the first header as `"\uFEFFname"` instead of `"name"`. All lookups against `"name"` fail.

### 5. No Required Header Validation

Your downstream code expects `email` column. User uploads CSV without it. Your code crashes with `Cannot read property 'toLowerCase' of undefined`.

## The Lesson

CSV looks simple. It isn't. Without a real parser, quoted fields, injection attacks, and resource exhaustion will destroy your API.

## What v2 Fixes

TypeScript. Before we handle CSV complexity, let's stop type errors.
