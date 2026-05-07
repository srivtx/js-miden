# Thinking Exercises

## 1. The Async Error

You have:
```javascript
app.get('/', async (req, res) => {
  const data = await fetchData();
  res.json(data);
});
```

If `fetchData()` throws, what happens in Express 4 vs Express 5?

---

## 2. The Error Response

A client sends invalid JSON. Your parser throws. What status code? What response body?

**Question:** Should you return 400 or 500? What's the difference?

---

## 3. The Retry Question

Your database connection fails. The error is transient (network blip).

**Question:** Should you retry? How many times? What if it's not transient?

---

## 4. The Error Log

You log every error. After a bad deploy, you generate 10,000 errors/second.

**Question:** What happens to your logging infrastructure? How do you prevent log-induced outages?

---

## 5. The User Message

A payment fails. The error is: `ECONNREFUSED 10.0.1.50:5432`.

**Question:** What do you show the user? What do you log internally?
