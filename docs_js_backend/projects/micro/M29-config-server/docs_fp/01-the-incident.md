# The 3AM Page: The Cross-Environment Leak

It's 3:00 AM. Staging is using production data.

**Dev:** "Why does staging have real customer emails?"

You check the config server:
```javascript
app.get('/config', (req, res) => {
  const env = req.headers['x-env'];
  res.json(configs[env]);
});
```

**No validation. Any environment can request any config.**

Staging requested `x-env: production`. Got production database credentials.

**Staging now connected to production DB.**
