# The 3AM Page: The Case-Sensitive Bypass

It's 3:00 AM. Auth is bypassed.

**Security:** "Requests with lowercase `x-auth-token` bypass validation."

Your validator:
```javascript
if (req.headers['X-Auth-Token']) {
  validateToken(req.headers['X-Auth-Token']);
}
```

**HTTP headers are case-insensitive.** `x-auth-token` and `X-Auth-Token` are the same.

**But your code checks exact case.** Attacker sends lowercase. Your check misses it.
