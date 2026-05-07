# Impossible Constraint: No try/catch

**Task:** Handle errors in an async function without `try/catch`.

**Constraint:** You cannot use `try/catch`, `.catch()`, or `await` with error handling.

---

## Your Turn

You have:
```javascript
function getUser(id) {
  return db.query('SELECT * FROM users WHERE id = ?', [id]);
}
```

How do you handle errors without try/catch?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Use Events or Callbacks

```javascript
// Before async/await (Node.js < 8)
getUser(123, (err, user) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(user);
});
```

Or with EventEmitter:
```javascript
const emitter = new EventEmitter();
emitter.on('error', (err) => console.error(err));
emitter.emit('getUser', 123);
```

**The point:** `try/catch` is syntactic sugar for something fundamental. Before it existed, we handled errors explicitly. The "invisible" nature of `try/catch` makes us forget that errors are just values that need handling.

**Modern JavaScript has two error models:**
1. **Throw/catch** — for exceptional, unexpected errors
2. **Result types** — for expected failures (like Rust's `Result<T, E>`)

Most APIs should return errors, not throw them.
