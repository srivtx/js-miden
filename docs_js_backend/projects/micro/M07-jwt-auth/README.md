# M07: JWT Generator / Verifier

A minimal JWT authentication microservice built with Express 5, TypeScript, and ESM.

## Setup

```bash
npm install
JWT_SECRET="super-strong-secret-at-least-32-chars-long" npm run dev
JWT_SECRET="super-strong-secret-at-least-32-chars-long" npm test
```

## API

- `POST /login` — Body: `{ "userId": "..." }`. Returns a JWT valid for 1 hour.
- `GET /protected` — Header: `Authorization: Bearer <token>`. Returns protected data if the token is valid and not expired.

## Phase 2-3 Thinking Framework

### 1. JWT vs Sessions (stateless vs stateful)
- **Sessions**: Server stores session state (usually in Redis/DB). Client holds only a session ID cookie. Easy to revoke instantly, but requires shared storage in multi-node deployments.
- **JWT**: Self-contained token with claims. No server-side session storage needed, making horizontal scaling trivial. Revocation is harder (requires blocklists or short expiry + refresh tokens).
- **Decision**: JWT is excellent for stateless microservices and micro-frontends where immediate revocation is not a hard requirement.

### 2. Where to Store the Secret?
- **Never hardcode secrets in source code**—they end up in Git history and are exposed to anyone with repo access.
- Use environment variables (`process.env.JWT_SECRET`) injected at runtime via a secrets manager (HashiCorp Vault, AWS Secrets Manager, Docker secrets, etc.).
- For HS256, the secret should be a cryptographically random string of at least 256 bits (32+ bytes).
- For RS256, use a private key file with strict filesystem permissions (`0400`).

### 3. What Algorithm? (HS256 vs RS256)
- **HS256 (HMAC + SHA-256)**: Symmetric. Fast, simple, and fine when a single service issues and verifies tokens. Requires secure distribution of the one shared secret.
- **RS256 (RSA + SHA-256)**: Asymmetric. Auth service holds the private key to sign; any service can verify with the public key. Essential in distributed systems with many verifiers.
- **Avoid**: `none` algorithm. It removes the signature entirely, allowing anyone to forge tokens.

### 4. What Claims?
- `sub` (subject): Identity of the user (e.g., user ID).
- `iat` (issued at): Timestamp when the token was created. Useful for TTL calculations.
- `exp` (expiration): Absolute expiry timestamp. Prevents indefinite token reuse if leaked.
- Optional: `iss` (issuer), `aud` (audience), `jti` (JWT ID for revocation lists).

## The Bug

`src/routes/auth.ts` passes `ignoreExpiration: true` to `jwt.verify()`.

**Consequences**:
- Tokens that expired hours, days, or years ago are still accepted as valid.
- A leaked token remains usable forever, defeating the purpose of the 1-hour expiry.
- Attackers with stolen credentials retain access even after the legitimate user expects the session to be dead.

## How to Fix

Remove the `ignoreExpiration: true` option (or explicitly set it to `false`):

```typescript
const decoded = jwt.verify(token, SECRET, {
  algorithms: ['HS256'],
  // ignoreExpiration defaults to false—leave it out.
});
```

Also ensure your login endpoint actually sets an expiry:

```typescript
jwt.sign({ sub: userId }, SECRET, { expiresIn: '1h', algorithm: 'HS256' });
```

## Test Failure

Run `npm test`. The test **"should reject expired tokens"** fails because the server responds with `200 OK` instead of `401 Unauthorized`—the expired token is treated as valid.
