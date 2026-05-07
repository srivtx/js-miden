# The 3AM Page: The Stack Trace

It's 5:47 AM. Your Slack is exploding.

**Security Team:** "We're seeing our database connection strings in public GitHub repos."

You check the logs. Then you check Twitter. Someone posted a screenshot:

```
Error: connect ECONNREFUSED 10.0.1.50:5432
    at /app/node_modules/pg/lib/connection.js:123:15
    at /app/src/database.ts:45:12
    at /app/src/routes/users.ts:23:8
```

Your error handler sends full stack traces to the client. Including internal IP addresses, file paths, and module names.

An attacker now knows:
- Your database IP: `10.0.1.50`
- Your database port: `5432`
- Your internal file structure
- That you use PostgreSQL (`pg` module)

---

## Your Turn

### Q1: Why is `err.stack` dangerous in production?

Think about what a stack trace contains.

<br><br><br><br><br>

---

## The Autopsy

### Answer: Stack traces are intelligence

A stack trace contains:
- File paths (`/app/src/database.ts`)
- Internal IP addresses (`10.0.1.50`)
- Module names (`pg`, `prisma`, `typeorm`)
- Function names and line numbers
- Error messages that might contain SQL queries

**This is a reconnaissance goldmine.** An attacker can:
1. Map your internal architecture
2. Identify technology stack (for targeted exploits)
3. Find internal network ranges
4. Discover file structure (helps with path traversal)

### The Fix

```javascript
app.use((err, req, res, next) => {
  // Log full error internally
  logger.error({ err, requestId: req.id }, 'Unhandled error');
  
  // Send generic message to client
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id // So support can look it up
  });
});
```

**Client gets:** Generic error + request ID.
**You get:** Full stack trace in logs.
