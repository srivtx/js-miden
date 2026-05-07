# Three Wrong Ways to Parse CSV

---

## Wrong #1: Split by Comma

```javascript
const rows = csv.split('\n').map(row => row.split(','));
```

**Why it looks right:** CSV is "comma-separated." Split by comma. Done.

**Why it's wrong:**
- Doesn't handle quoted fields
- Doesn't handle commas inside quotes
- Doesn't handle newlines inside quotes
- Breaks on every real-world CSV

---

## Wrong #2: Regular Expression

```javascript
const regex = /(?:,|\n|^)("(?:""|[^"])*"|[^",\n]*)/g;
```

**Why it looks right:** Regex can parse structured data.

**Why it's wrong:**
- CSV is not a regular language (nested quotes make it context-sensitive)
- Regex backtracking is slow on large files
- Edge cases (empty fields, trailing commas) break regex parsers

---

## Wrong #3: Evaluating Formula Cells

```javascript
const rows = parseCSV(csv);
for (const row of rows) {
  if (row[1].startsWith('=')) {
    const result = eval(row[1].slice(1)); // Execute formula!
    row[1] = result;
  }
}
```

**Why it looks right:** Spreadsheets evaluate formulas. Our parser should too!

**Why it's wrong:**
- `eval()` executes arbitrary code
- `=CMD|' /C calc'!A0` becomes `CMD|' /C calc'!A0`
- Complete system compromise
