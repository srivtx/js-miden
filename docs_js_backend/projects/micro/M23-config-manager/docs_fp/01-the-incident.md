# The 3AM Page: The Production Config in Dev

It's 3:00 AM. A developer is testing locally.

**Dev:** "Why is my local app connecting to the production database?"

You check the config code:
```javascript
const config = require('./config.json');
// config.json has "database": "prod-db.internal"
```

The config file is committed to git. Everyone shares the same file.

**A dev accidentally ran a migration script against production.**

**Result:** Production database corrupted. 4-hour outage.

---

## Your Turn

### Q1: Why is sharing config files dangerous?

It's just settings. What's the harm?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Environments need isolation

- **Development:** Local DB, debug logging, mock services
- **Staging:** Staging DB, warning logging, real services
- **Production:** Production DB, error logging, real services

**If they share a config file, someone WILL accidentally use production in dev.**

### The Fix: Environment Variables

```javascript
const config = {
  database: process.env.DATABASE_URL,
  logLevel: process.env.LOG_LEVEL || 'info',
  port: parseInt(process.env.PORT || '3000'),
};
```

**`.env` file (NOT committed):**
```
DATABASE_URL=postgresql://localhost/dev
LOG_LEVEL=debug
```

**Production:** Set via deployment platform (Kubernetes secrets, AWS Parameter Store).
