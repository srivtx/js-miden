# M08: Password Hasher — Step-by-Step Build Guide

## Prerequisites

- Node.js ≥ 18
- `argon2` package (or `bcrypt` as fallback)
- `crypto` module (built-in)

---

## Step 1: Install Dependencies

```bash
npm install argon2
# or
npm install bcrypt
```

**Note:** `argon2` requires a C++ compiler. On macOS, install Xcode Command Line Tools. In Docker, use `node:18` base image with `build-essential`.

---

## Step 2: Configure Hashing Parameters

```typescript
// config/auth.ts
export const HASH_CONFIG = {
  algorithm: 'argon2id' as const,
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 parallel threads
  saltLength: 16,       // 16 bytes = 128 bits
  hashLength: 32,       // 32 bytes = 256 bits
};

// Fallback for systems where argon2 compilation fails
export const BCRYPT_FALLBACK = {
  rounds: 12,
};
```

**Tune on your hardware:**

```typescript
// benchmark.ts
import * as argon2 from 'argon2';

async function benchmark() {
  const password = 'test_password_123';
  const start = Date.now();

  for (let i = 0; i < 10; i++) {
    await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  const avg = (Date.now() - start) / 10;
  console.log(`Average hash time: ${avg}ms`);
  // Target: 250ms–1000ms
}
```

---

## Step 3: Hash Service

```typescript
// services/password.ts
import * as argon2 from 'argon2';
import { timingSafeEqual } from 'crypto';
import { HASH_CONFIG } from '../config/auth';

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: HASH_CONFIG.memoryCost,
    timeCost: HASH_CONFIG.timeCost,
    parallelism: HASH_CONFIG.parallelism,
    saltLength: HASH_CONFIG.saltLength,
    hashLength: HASH_CONFIG.hashLength,
  });
}

export async function verifyPassword(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, plainPassword);
  } catch {
    return false;
  }
}
```

**Why `argon2.verify`?**
The `argon2` library's `verify` function internally uses constant-time comparison. It also extracts the embedded salt and parameters from the hash string automatically.

---

## Step 4: Constant-Time Comparison (Manual Implementation)

If you ever need to compare hashes manually (e.g., legacy system migration):

```typescript
import { timingSafeEqual } from 'crypto';

export function safeCompareHash(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  if (bufA.length !== bufB.length) {
    // Still do a comparison to avoid leaking length info via timing
    // In practice, lengths are usually known from the hash format
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
```

**Important:** `timingSafeEqual` throws if buffers have different lengths. Always check length first.

---

## Step 5: Pepper Support (Optional)

```typescript
const PEPPER = process.env.PASSWORD_PEPPER!;

export async function hashPasswordWithPepper(plainPassword: string): Promise<string> {
  const peppered = plainPassword + PEPPER;
  return hashPassword(peppered);
}

export async function verifyPasswordWithPepper(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  const peppered = plainPassword + PEPPER;
  return verifyPassword(peppered, storedHash);
}
```

**Pepper rules:**
- Minimum 32 bytes of cryptographically random data
- Stored in environment variable or HSM, never in the database
- Rotating a pepper requires re-hashing all passwords

---

## Step 6: Hash Upgrade on Login

```typescript
interface User {
  id: string;
  passwordHash: string;
}

async function verifyAndRehashIfNeeded(
  user: User,
  plainPassword: string
): Promise<{ valid: boolean; rehashed?: string }> {
  const valid = await verifyPassword(plainPassword, user.passwordHash);

  if (!valid) {
    return { valid: false };
  }

  // Check if hash uses current parameters
  const needsRehash = argon2.needsRehash(user.passwordHash, {
    type: argon2.argon2id,
    memoryCost: HASH_CONFIG.memoryCost,
    timeCost: HASH_CONFIG.timeCost,
    parallelism: HASH_CONFIG.parallelism,
  });

  if (needsRehash) {
    const newHash = await hashPassword(plainPassword);
    return { valid: true, rehashed: newHash };
  }

  return { valid: true };
}

// Usage in login endpoint
app.post('/api/auth/login', async (req, res) => {
  const user = await findUserByEmail(req.body.email);
  if (!user) {
    // Always hash to prevent timing attacks on user enumeration
    await hashPassword('dummy');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { valid, rehashed } = await verifyAndRehashIfNeeded(user, req.body.password);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (rehashed) {
    await updateUserPasswordHash(user.id, rehashed);
  }

  // Issue session/token...
});
```

**Why hash a dummy on missing user?**
To prevent attackers from measuring response time to determine if an email is registered.

---

## Step 7: Integration Test

```typescript
import { hashPassword, verifyPassword } from './services/password';

describe('Password Hasher', () => {
  it('should hash and verify a password', async () => {
    const password = 'my_secure_password_123';
    const hash = await hashPassword(password);

    expect(hash).toContain('$argon2id$');
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('wrong_password', hash)).toBe(false);
  });

  it('should produce different hashes for the same password', async () => {
    const password = 'same_password';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  it('should take reasonable time (>100ms)', async () => {
    const start = Date.now();
    await hashPassword('test');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThan(100);
  });
});
```

---

## Testing Checklist

- [ ] Same password produces different hashes (salt working)
- [ ] Correct password verifies as true
- [ ] Incorrect password verifies as false
- [ ] Hash time is > 100ms (slow enough)
- [ ] Hash time is < 2000ms (not too slow for UX)
- [ ] `needsRehash` returns true for old parameter sets
- [ ] Missing user path hashes dummy password (timing safety)
- [ ] Special characters and Unicode passwords work
- [ ] Very long passwords (> 72 bytes for bcrypt) are handled
