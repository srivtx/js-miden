# AES Block Modes: ECB vs CBC vs GCM

## The Problem with ECB (Electronic Codebook)

ECB encrypts each block independently with the same key. This means **identical plaintext blocks produce identical ciphertext blocks**.

### Diagram: Why ECB Leaks Patterns

```
Plaintext image (Tux penguin)          ECB encrypted (still recognizable!)
┌─────────────────────┐                ┌─────────────────────┐
│ ░░▓▓▓▓░░            │                │ ░░▓▓▓▓░░            │
│ ░░▓▓▓▓░░            │                │ ░░▓▓▓▓░░            │
│   ▓▓▓▓              │   ──ECB──▶     │   ▓▓▓▓              │
│   ▓▓▓▓              │                │   ▓▓▓▓              │
│ ▓▓▓▓▓▓▓▓            │                │ ▓▓▓▓▓▓▓▓            │
│ ▓▓    ▓▓            │                │ ▓▓    ▓▓            │
│▓▓      ▓▓           │                │▓▓      ▓▓           │
└─────────────────────┘                └─────────────────────┘
   Still looks like a penguin!          Pattern is preserved.
```

**Real-world consequence**: In 2013, researchers demonstrated that encrypted Wi-Fi credentials stored by certain routers using ECB-mode AES were recoverable because of repeated block patterns in XML configs.

## CBC (Cipher Block Chaining)

CBC XORs each plaintext block with the previous ciphertext block before encryption. This breaks the pattern leak, but CBC has **no built-in authentication**.

```
Block 1                Block 2                Block 3
┌─────────┐           ┌─────────┐           ┌─────────┐
│  P1     │──XOR──┐   │  P2     │──XOR──┐   │  P3     │──XOR──┐
└─────────┘       │   └─────────┘       │   └─────────┘       │
     │            ▼        │            ▼        │            ▼
     │       ┌───────┐     │       ┌───────┐     │       ┌───────┐
     └──────▶│  IV   │     └──────▶│  C1   │     └──────▶│  C2   │
             └───┬───┘             └───┬───┘             └───┬───┘
                 │                     │                     │
             ┌───┴───┐             ┌───┴───┐             ┌───┴───┐
             │  ENC  │             │  ENC  │             │  ENC  │
             └───┬───┘             └───┬───┘             └───┬───┘
                 │                     │                     │
                 ▼                     ▼                     ▼
               ┌─────┐               ┌─────┐               ┌─────┐
               │ C1  │               │ C2  │               │ C3  │
               └─────┘               └─────┘               └─────┘
```

**CBC weaknesses**:
- Requires a random IV for every encryption
- No integrity checking (Padding Oracle attacks are possible without HMAC)
- Must combine with HMAC (Encrypt-then-MAC) to be secure

## GCM (Galois/Counter Mode) — The Recommended Mode

GCM provides both **confidentiality** and **authentication** in a single pass. It is an **AEAD** (Authenticated Encryption with Associated Data) mode.

```
Counter Mode Encryption          +   GHASH Authentication
┌─────────────┐                 │   ┌─────────────┐
│  Counter 0  │──▶ ENC ──▶ Tag │   │  CipherText │──▶
│  Counter 1  │──▶ ENC ──XOR──▶ P1│   │     blocks  │   GHASH ──▶ Auth Tag
│  Counter 2  │──▶ ENC ──XOR──▶ P2│   │             │
│  Counter N  │──▶ ENC ──XOR──▶ PN│   └─────────────┘
└─────────────┘                 │   (includes AAD like headers)
         Key + Nonce            │
```

**GCM advantages**:
- **One-pass**: faster than CBC + HMAC
- **Built-in authentication**: tampering is detected
- **Parallelizable**: CTR mode allows parallel encryption
- **Associated Data (AAD)**: authenticate unencrypted metadata (file ID, owner)

## Comparison Table

| Feature | ECB | CBC | GCM |
|---|---|---|---|
| Confidentiality | Weak (pattern leak) | Strong | Strong |
| Integrity | None | None (needs HMAC) | Built-in (AEAD) |
| Parallel encryption | Yes | No | Yes |
| Parallel decryption | Yes | Yes | Yes |
| Recommended | Never | Legacy only | Yes |

## Implementation Notes

```typescript
import { createCipheriv, randomBytes, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_SIZE = 32;
const IV_SIZE = 16;  // Node.js uses 16-byte IV for aes-256-gcm
const TAG_SIZE = 16;

function encrypt(plaintext: Buffer, key: Buffer, aad?: Buffer) {
  const iv = randomBytes(IV_SIZE);
  const cipher = createCipheriv(ALGO, key, iv);
  if (aad) cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

function decrypt(ciphertextWithMeta: Buffer, key: Buffer, aad?: Buffer) {
  const iv = ciphertextWithMeta.subarray(0, IV_SIZE);
  const tag = ciphertextWithMeta.subarray(IV_SIZE, IV_SIZE + TAG_SIZE);
  const ciphertext = ciphertextWithMeta.subarray(IV_SIZE + TAG_SIZE);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(aad);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
```

## OWASP Reference
> "Use authenticated encryption modes (GCM, CCM, EAX, or ChaCha20-Poly1305) instead of CBC or ECB." — OWASP Cryptographic Storage Cheat Sheet

> "ECB should not be used for encrypting more than one block of data." — NIST SP 800-38A
