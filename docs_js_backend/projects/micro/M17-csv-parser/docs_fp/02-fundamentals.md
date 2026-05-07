# Fundamentals: CSV Parsing from Scratch

**Task:** Parse CSV using only string operations. No `csv-parse` library.

RFC 4180 rules:
- Fields separated by commas
- Fields may be quoted with double quotes
- Quotes inside quotes are escaped as `""`
- Newlines inside quotes are part of the field

Example:
```csv
name,age,city
"Doe, John",30,"New York, NY"
"Smith ""Bob""",25,LA
```

---

## Multiple Choice: Quoted Newlines

**Q:** How many rows in this CSV?
```csv
name,description
Alice,"Line 1
Line 2"
Bob,"Another"
```

**A)** 2 rows (Alice has a multiline description)

**B)** 3 rows (newline = new row)

**C)** 4 rows

**D)** Invalid CSV

**Think before reading on.**

---

## The Answer

**A is correct.**

The newline inside quotes is part of the field, not a row delimiter. This is why you can't parse CSV with `String.split('\n')`.

**The naive parser breaks:**
```javascript
// WRONG
const rows = csv.split('\n').map(row => row.split(','));
```

This gives you:
```
Row 1: ["name", "description"]
Row 2: ["Alice", ""Line 1"]       // Broken!
Row 3: ["Line 2""]               // Broken!
```

**You need a state machine:**
```javascript
function parseCSV(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];
    
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++; // Skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }
  
  // Push last row
  row.push(field);
  if (row.length > 0) rows.push(row);
  
  return rows;
}
```

**This is why CSV parsers exist.** The format is simple to describe, complex to implement correctly.
