# Red Team: Exploiting Error Handling

---

## Attack 1: Information Leakage

**The vulnerability:**
```javascript
res.status(500).json({
  error: err.message,
  stack: err.stack
});
```

**Your attack:**
1. Trigger errors with malformed input
2. Collect stack traces
3. Map internal architecture
4. Find SQL injection points from error messages

**Impact:** Full reconnaissance of the system.

**Defense:** Never send `err.stack` or `err.message` to clients.

---

## Attack 2: Error-Based DoS

**The vulnerability:**
```javascript
try {
  JSON.parse(req.body); // On 10MB payload
} catch (err) {
  logError(err); // Synchronous logging blocks event loop
}
```

**Your attack:**
1. Send 10MB of invalid JSON
2. Server spends CPU parsing and logging
3. Event loop blocked for seconds
4. Other requests timeout

**Impact:** Denial of service via error generation.

**Defense:** Limit payload size. Use async logging.

---

## Attack 3: Error Message Injection

**The vulnerability:**
```javascript
throw new Error(`User ${req.query.name} not found`);
```

**Your attack:**
1. Set `name` to a script tag: `<script>alert(1)</script>`
2. If error message is rendered in HTML (error page, admin dashboard)
3. XSS via error message

**Impact:** Stored XSS in error logs or error pages.

**Defense:** Never interpolate user input into error messages without sanitization.
