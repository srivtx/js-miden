# Three Wrong Ways to Handle Config

---

## Wrong #1: Hardcoded Values

```javascript
const DB_URL = 'postgresql://prod-db.internal:5432/app';
```

**Why it's wrong:** Can't change without code deploy. Committed to git.

---

## Wrong #2: No Validation

```javascript
const port = process.env.PORT; // Could be undefined, "abc", or ""
app.listen(port);
```

**Why it's wrong:** `app.listen(undefined)` listens on a random port. `app.listen("abc")` crashes.

---

## Wrong #3: Sensitive Data in Code

```javascript
const API_KEY = 'sk-live-abc123';
```

**Why it's wrong:**
- In git history forever
- Visible to all developers
- Leaked if repo is public
