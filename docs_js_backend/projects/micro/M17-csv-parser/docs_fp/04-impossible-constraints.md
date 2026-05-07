# Impossible Constraint: Streaming Only

**Task:** Parse a 10GB CSV file with 2GB of RAM.

**Constraint:** You cannot load the entire file into memory.

---

## Your Turn

How do you parse CSV without loading it all?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: Streaming State Machine

You parse character-by-character using a stream:

```javascript
const fs = require('fs');
const stream = fs.createReadStream('huge.csv', { encoding: 'utf8' });

let state = 'START';
let field = '';
let row = [];

stream.on('data', chunk => {
  for (const char of chunk) {
    switch (state) {
      case 'START':
        if (char === '"') state = 'IN_QUOTES';
        else if (char === ',') { row.push(field); field = ''; }
        else if (char === '\n') { row.push(field); emitRow(row); row = []; field = ''; }
        else field += char;
        break;
      case 'IN_QUOTES':
        if (char === '"') state = 'QUOTE_END';
        else field += char;
        break;
      case 'QUOTE_END':
        if (char === '"') { field += '"'; state = 'IN_QUOTES'; }
        else if (char === ',') { row.push(field); field = ''; state = 'START'; }
        else if (char === '\n') { row.push(field); emitRow(row); row = []; field = ''; state = 'START'; }
        else { field += char; state = 'START'; } // Malformed but recover
        break;
    }
  }
});
```

**Memory usage:** O(row size), not O(file size).

**The point:** File size doesn't matter. What matters is how much state you keep.
