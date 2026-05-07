# Fundamentals: Implement Hashing from Scratch

**Task:** Build a password hasher using only Node.js `crypto`.

No bcrypt. No Argon2. Just `crypto`.

```javascript
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(password + salt)
    .digest('hex');
  return `${salt}:${hash}`;
}
```

---

## Multiple Choice: What's Wrong?

**A)** The salt should be base64, not hex

**B)** SHA-256 is too fast; should use PBKDF2 or scrypt

**C)** The salt is stored with the hash, defeating the purpose

**D)** `timingSafeEqual` isn't needed for hashing

**Think before reading on.**

---

## The Answer

**B is correct.**

- **A:** Hex vs base64 doesn't matter for security.
- **B:** SHA-256 is designed for speed. Password hashing needs intentional slowness. PBKDF2, scrypt, or Argon2 are designed to be slow.
- **C:** The salt MUST be stored with the hash. Otherwise you can't verify passwords later. The point of salt is that each user has a different one — not that it's secret.
- **D:** `timingSafeEqual` IS needed when comparing hashes. Otherwise timing attacks leak information.

---

## The Better Version

```javascript
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const actualHash = await scryptAsync(password, salt, 64);
  return timingSafeEqual(expectedHash, actualHash);
}
```

**Why scrypt?**
- Memory-hard: Requires lots of RAM, making GPU/ASIC attacks expensive
- Configurable cost: You can increase difficulty as hardware improves
- Standard: Well-studied, widely implemented

**Why not SHA-256 + 100,000 iterations?**
- Still fast on GPUs. SHA-256 is hardware-accelerated.
- Not memory-hard. GPUs have thousands of cores.
