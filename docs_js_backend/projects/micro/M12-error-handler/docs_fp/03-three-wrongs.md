# Three Wrong Ways to Handle Errors

---

## Wrong #1: Silent Swallowing

```javascript
try {
  await riskyOperation();
} catch (err) {
  // TODO: handle error
}
```

**Why it looks right:** The app doesn't crash. Users see success.

**Why it's wrong:**
- The error is invisible. You'll never know it happened.
- Data might be corrupted. The operation "succeeded" but didn't.
- Debugging becomes impossible.

---

## Wrong #2: Res Twice

```javascript
app.get('/user', async (req, res) => {
  try {
    const user = await getUser();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
  res.send('Done'); // Second response!
});
```

**Why it looks right:** Send a response in both success and error cases.

**Why it's wrong:**
- You can't send two responses to one request
- `res.send('Done')` throws "Cannot set headers after they are sent"
- This creates ANOTHER error, potentially masking the original

**Fix:** Use `return`:
```javascript
if (!user) return res.status(404).json({ error: 'Not found' });
```

---

## Wrong #3: Different Error Formats

```javascript
// Route A
res.status(400).json({ error: 'Bad request' });

// Route B
res.status(400).json({ message: 'Invalid input' });

// Route C
res.status(400).send('Error: missing field');
```

**Why it looks right:** Each developer handles errors their way.

**Why it's wrong:**
- Frontend must handle 3 different error formats
- Clients can't reliably parse errors
- Inconsistent UX

**Fix:** Use RFC 7807 (Problem Details):
```json
{
  "type": "https://api.example.com/errors/invalid-request",
  "title": "Invalid Request",
  "status": 400,
  "detail": "The 'email' field is required."
}
```
