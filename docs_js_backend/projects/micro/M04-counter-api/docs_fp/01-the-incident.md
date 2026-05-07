# The 3AM Page: The Lost Clicks

It's Black Friday. 2:47 AM.

**Business:** "Analytics show 10,000 clicks on the 'Buy' button. Only 7,000 orders. Where are 3,000 clicks?"

You check the counter service:

```javascript
let count = 0;

app.post('/click', (req, res) => {
  count++; // Read
  // ... process ...
  res.json({ count }); // Write (not really, just return)
});
```

Wait. This is in-memory. On a single server. You have 8 servers behind a load balancer.

Each server has its own `count`. User A hits server 1 (count=100). User B hits server 2 (count=100). Both read 100, both increment to 101. Two clicks, one counted.

**3,000 lost clicks = $150,000 in lost attribution data.**

---

## Your Turn

### Q1: Why does `count++` lose increments?

It's a single line of code. How can it be wrong?

<br><br><br><br><br>

---

## The Autopsy

### Answer: `count++` is not atomic

```javascript
count++;
```

This compiles to:
```asm
mov eax, [count]    ; Read count into register
inc eax             ; Increment register
mov [count], eax    ; Write back
```

**Three steps. Two threads can interleave:**

Thread A reads count=100
Thread B reads count=100
Thread A increments to 101, writes
Thread B increments to 101, writes

**Result: count=101. Two increments, one counted.**

### The Scale Problem

With 8 servers and 1000 req/s:
- Each server handles ~125 req/s
- Each server has its own counter
- Total counted = sum of 8 independent counters
- But you want GLOBAL count

**In-memory counters don't scale horizontally.**
