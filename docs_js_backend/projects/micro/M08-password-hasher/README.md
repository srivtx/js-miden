# M08 Password Hasher API

Express 5 + TypeScript (ESM) micro service.

## Endpoints

- `POST /hash` – accepts `{ password: string }`, returns a hash.
- `POST /verify` – accepts `{ password: string, hash: string }`, returns `{ match: boolean }`.

## Quick start

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```

## Design Notes (Phase 2-3)

- **bcrypt vs argon2 vs scrypt**: Argon2 is the modern winner (OWASP recommendation). bcrypt is fine for legacy. scrypt is memory-hard.
- **Salt rounds**: 10–12 for dev, 13+ for prod. Prevents rainbow-table attacks.
- **Why NOT MD5/SHA1/SHA256 for passwords**: They are designed to be fast. Fast hashes allow attackers to brute-force billions of passwords per second on GPUs.
- **Timing attacks**: Using `===` to compare hashes leaks timing information. An attacker can measure tiny differences in response time to guess the hash byte-by-byte. Always use constant-time comparison (e.g., `crypto.timingSafeEqual`).

## Known Bugs (intentional)

1. **Fast hash without salt**: Uses SHA-256 instead of bcrypt/Argon2. Identical passwords produce identical hashes, making the service vulnerable to rainbow-table and GPU cracking attacks.
2. **Timing attack vulnerability**: Verification uses a simple `===` comparison instead of a constant-time algorithm, leaking information about the hash via timing side-channels.
