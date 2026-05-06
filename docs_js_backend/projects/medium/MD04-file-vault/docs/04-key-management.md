# Key Management

## The Core Problem
If an attacker steals your encrypted files **and** your encryption keys, encryption is useless. Key management is the hardest part of cryptography.

## Key Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    KEY HIERARCHY                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐                                        │
│  │  Master Key     │  (HSM / AWS KMS / HashiCorp Vault)    │
│  │  (KEK)          │  Never leaves the KMS.                │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼ Encrypt / Decrypt                                │
│  ┌─────────────────┐                                        │
│  │  Data Key       │  (DEK) One per file / per user batch  │
│  │  (AES-256-GCM)  │  Stored encrypted in database.        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼ Encrypt / Decrypt                                │
│  ┌─────────────────┐                                        │
│  │  File Content   │  Stored in object storage (S3/MinIO)  │
│  │  (Ciphertext)   │                                        │
│  └─────────────────┘                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Envelope Encryption

**Envelope encryption** wraps the data key (DEK) with a master key (KEK). This means:
- The master key never touches the file data
- You can rotate the master key by re-wrapping DEKs
- Compromise of a single DEK only exposes one file

```typescript
// Generate a new data key
async function generateDataKey(kmsClient: KMSClient): Promise<Buffer> {
  const command = new GenerateDataKeyCommand({
    KeyId: 'alias/file-vault-master',
    KeySpec: 'AES_256',
  });
  const response = await kmsClient.send(command);
  // Plaintext key is used once, then discarded from memory
  return response.Plaintext! as Buffer;
}

// Encrypt a file, then discard the plaintext DEK
async function encryptFileWithEnvelope(
  filePath: string,
  kmsClient: KMSClient
): Promise<{ encryptedKey: Buffer, fileId: string }> {
  const dek = await generateDataKey(kmsClient);
  const encryptedDek = (await kmsClient.send(new EncryptCommand({
    KeyId: 'alias/file-vault-master',
    Plaintext: dek,
  }))).CiphertextBlob!;

  const fileId = await uploadEncryptedFile(filePath, dek);

  // Securely clear DEK from memory
  dek.fill(0);

  await saveToDatabase({ fileId, encryptedKey: Buffer.from(encryptedDek) });
  return { encryptedKey: Buffer.from(encryptedDek), fileId };
}
```

## Key Rotation

### Master Key Rotation
- Create a new master key version in KMS
- Re-wrap all DEKs with the new master key
- Schedule deletion of the old key version after a grace period

### Data Key Rotation
- For active files, decrypt with old DEK, re-encrypt with new DEK
- For archived files, this may be deferred or never done (risk/cost trade-off)

## Key Storage Strategies

| Strategy | Pros | Cons |
|---|---|---|
| **AWS KMS** | Managed HSM, audit logs, IAM integration | Cloud lock-in, latency per call |
| **HashiCorp Vault** | Self-hosted, pluggable backends | Operational complexity |
| **Local HSM** (YubiHSM, Luna) | Highest security, air-gapped | Expensive, single point of failure |
| **Environment variable** | Simple | **Never do this** — keys leak in logs, dumps |

## Key Derivation from User Passwords

If users must unlock files with passwords, use **Argon2id** (or scrypt) to derive keys:

```typescript
import { randomBytes, scryptSync } from 'crypto';

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, {
    N: 32768,  // CPU/memory cost
    r: 8,
    p: 1,
  });
}

// Store salt alongside the encrypted data
const salt = randomBytes(32);
const key = deriveKey(userPassword, salt);
```

**Never use PBKDF2 for new systems** unless required by legacy compatibility. Argon2id won the Password Hashing Competition (PHC) in 2015.

## OWASP & NIST References

> "Keys should be stored in a dedicated key-management system (KMS) or hardware security module (HSM). Keys should never be stored alongside the data they protect." — OWASP Key Management Cheat Sheet

> "NIST SP 800-57 recommends AES-256 for data with a security lifetime beyond 2030." — NIST Recommendation for Key Management
