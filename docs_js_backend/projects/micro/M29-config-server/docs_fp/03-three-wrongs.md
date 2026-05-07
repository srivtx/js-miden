# Three Wrong Ways to Handle Config

---

## Wrong #1: Client-Specified Env

```javascript
const env = req.query.env;
res.json(configs[env]);
```

**Why it's wrong:** Client can request any environment. Complete trust.

---

## Wrong #2: No Authentication

```javascript
app.get('/config', (req, res) => {
  res.json(allConfig); // Everything!
});
```

**Why it's wrong:** Anyone can see everything. Secrets exposed.

---

## Wrong #3: Plaintext Storage

```javascript
// Config stored in JSON file, unencrypted
```

**Why it's wrong:** File leaks = all secrets exposed.
