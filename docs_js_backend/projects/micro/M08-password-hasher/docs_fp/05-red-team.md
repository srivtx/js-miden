# Red Team: Attacking Password Storage

---

## Attack 1: Timing Attack on Comparison

**The code:**
```javascript
function verifyPassword(input, stored) {
  const inputHash = hash(input);
  return inputHash === stored; // String comparison!
}
```

**The vulnerability:** `===` on strings short-circuits. If the first byte differs, it returns false immediately.

**Your attack:**
1. Send passwords starting with 'a', 'b', 'c'...
2. Measure response time. The correct first character takes slightly longer (compares more bytes).
3. Repeat byte-by-byte.

**Impact:** You can reconstruct the password hash one byte at a time.

**Defense:** Use `timingSafeEqual`:
```javascript
return timingSafeEqual(Buffer.from(inputHash), Buffer.from(stored));
```

---

## Attack 2: Salt Reuse

**The code:**
```javascript
const GLOBAL_SALT = 'company-name-2024';

function hashPassword(password) {
  return bcrypt.hashSync(password + GLOBAL_SALT, 10);
}
```

**The vulnerability:** Same salt for all users.

**Your attack:**
1. Build a rainbow table for the global salt
2. Crack all users simultaneously
3. 10,000 users with "password123" → all cracked at once

**Defense:** Unique salt per user (bcrypt does this automatically).

---

## Attack 3: Length Limitation Bypass

**The code:**
```javascript
function hashPassword(password) {
  if (password.length > 72) password = password.slice(0, 72);
  return bcrypt.hash(password, 12);
}
```

**The vulnerability:** bcrypt truncates at 72 bytes. If the user enters a 100-character password, only the first 72 matter.

**Your attack:**
1. Find a user with a very long password
2. The effective password is only 72 characters
3. Brute-force the shorter effective password

**Defense:** Pre-hash with SHA-256, then bcrypt:
```javascript
const prehash = crypto.createHash('sha256').update(password).digest();
return bcrypt.hash(prehash, 12);
```
