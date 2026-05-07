# Fundamentals: Error Handling Without Express

**Task:** Build error handling for raw Node.js `http` server.

```javascript
const server = http.createServer((req, res) => {
  try {
    handleRequest(req, res);
  } catch (err) {
    // What do you do here?
  }
});
```

---

## Multiple Choice: The Catch Block

**Q:** What happens if you throw an error inside an async function?

```javascript
async function handleRequest(req, res) {
  const user = await db.getUser(req.params.id); // throws
  res.json(user);
}
```

**A)** The `catch` block in `createServer` catches it

**B)** The error crashes the process

**C)** The error is silently swallowed

**D)** It depends on whether there's a `.catch()`

**Think before reading on.**

---

## The Answer

**B is correct.**

An async function returns a Promise. If it throws, the Promise rejects. A `try/catch` around the function call catches synchronous throws, not Promise rejections.

**This is the #1 Express error handling mistake:**

```javascript
// WRONG - async errors crash the process
app.get('/user/:id', async (req, res) => {
  const user = await db.getUser(req.params.id);
  res.json(user);
});
```

**The fix:**
```javascript
// Option 1: Wrap async handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/user/:id', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.id);
  res.json(user);
}));

// Option 2: Use Express 5 (handles async errors natively)
```
