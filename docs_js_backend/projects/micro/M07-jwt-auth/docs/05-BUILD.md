# M07: JWT Auth — Step-by-Step Build Guide

## Prerequisites

- Node.js ≥ 18
- `jsonwebtoken` package (or `jose` for modern Web Crypto API)
- `express` for HTTP server
- `cookie-parser` for cookie handling

---

## Step 1: Generate Keys

### For HS256 (Symmetric)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Save to .env: JWT_SECRET=your-64-char-hex-string
```

### For RS256 (Asymmetric)

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

---

## Step 2: Create Token Service

```typescript
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

interface TokenPayload {
  sub: string;      // user ID
  email: string;
  role: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    {
      ...payload,
      jti: randomUUID(),        // unique token ID for revocation
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_EXPIRY,
      audience: 'my-api',
      issuer: 'auth-service',
    }
  );
}

export function generateRefreshToken(userId: string): string {
  const token = randomUUID() + randomUUID(); // 72 chars, not a JWT
  // Store hash in database with user_id and expiry
  return token;
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],      // explicit allow-list
    audience: 'my-api',
    issuer: 'auth-service',
    clockTolerance: 60,         // 60 seconds skew tolerance
    // NEVER set: ignoreExpiration: true
  }) as TokenPayload;
}
```

---

## Step 3: Login Endpoint (Cookie-Based)

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cookieParser());

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Validate credentials (compare hashed password)
  const user = await validateCredentials(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 2. Generate tokens
  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = generateRefreshToken(user.id);
  await storeRefreshTokenHash(refreshToken, user.id);

  // 3. Set httpOnly cookies
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({ success: true });
});
```

---

## Step 4: Authentication Middleware

```typescript
export function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    // Read from cookie (modern) or Authorization header (fallback)
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const payload = verifyAccessToken(token);

    // Check revocation list (optional but recommended)
    if (await isTokenRevoked(payload.jti)) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

---

## Step 5: Refresh Endpoint

```typescript
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  // Look up hash in database
  const tokenRecord = await findRefreshTokenByHash(hashToken(refreshToken));

  if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < new Date()) {
    // Possible theft: invalidate entire token family
    if (tokenRecord?.used) {
      await invalidateTokenFamily(tokenRecord.familyId);
    }
    res.clearCookie('access_token', { path: '/api' });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  // Mark as used (single-use)
  await markRefreshTokenUsed(tokenRecord.id);

  // Issue new pair
  const newAccessToken = generateAccessToken({
    sub: tokenRecord.userId,
    email: tokenRecord.userEmail,
    role: tokenRecord.userRole,
  });
  const newRefreshToken = generateRefreshToken(tokenRecord.userId);
  await storeRefreshTokenHash(newRefreshToken, tokenRecord.userId, tokenRecord.familyId);

  res.cookie('access_token', newAccessToken, { /* same options */ });
  res.cookie('refresh_token', newRefreshToken, { /* same options */ });

  res.json({ success: true });
});
```

---

## Step 6: Logout Endpoint

```typescript
app.post('/api/auth/logout', authenticate, async (req, res) => {
  // Revoke access token via jti blocklist (short TTL in Redis)
  await revokeAccessToken(req.user.jti, req.user.exp);

  // Revoke refresh token family
  await invalidateRefreshTokenFamily(req.user.sub);

  res.clearCookie('access_token', { path: '/api' });
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });

  res.json({ success: true });
});
```

---

## Step 7: Protected Route

```typescript
app.get('/api/protected', authenticate, (req, res) => {
  res.json({ message: 'Hello ' + req.user.email });
});
```

---

## Testing Checklist

- [ ] Valid token → 200 OK
- [ ] Expired token → 401 Unauthorized
- [ ] Tampered signature → 401 Unauthorized
- [ ] Missing token → 401 Unauthorized
- [ ] Revoked token → 401 Unauthorized
- [ ] Refresh with used token → invalidates family, clears cookies
- [ ] XSS payload cannot read `document.cookie` (httpOnly)
- [ ] Cross-site POST without cookie (SameSite=Strict)
