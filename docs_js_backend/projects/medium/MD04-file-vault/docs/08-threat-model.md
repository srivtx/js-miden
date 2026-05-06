# Threat Model

## STRIDE Analysis

STRIDE is a threat classification model developed by Microsoft.

| Threat | Example in File Vault | Mitigation |
|---|---|---|
| **S**poofing | Attacker forges a JWT to impersonate a user | Short-lived JWTs, strong signing keys, rotation |
| **T**ampering | Attacker modifies ciphertext in S3 | AES-GCM authentication tag; tag verification on decrypt |
| **R**epudiation | User denies downloading a file | Immutable audit logs with hash chain |
| **I**nformation Disclosure | Attacker reads files from S3 bucket | Encryption at rest, pre-signed URLs with least privilege |
| **D**enial of Service | Attacker uploads 1 TB file to exhaust storage | File size limits, rate limiting, quotas |
| **E**levation of Privilege | Attacker changes role from VIEWER to OWNER | Server-side RBAC, role escalation requires re-authentication |

## Attack Scenarios

### Scenario 1: Compromised S3 Bucket
**Attack**: An attacker gains read access to the object storage bucket.
**Impact**: Files are unreadable because they are encrypted with AES-256-GCM.
**Mitigation**: Keys are stored in a separate KMS/Vault. The attacker only sees ciphertext.

### Scenario 2: Replay of Pre-Signed URL
**Attack**: Attacker intercepts a valid pre-signed URL and reuses it.
**Impact**: Unauthorized download within the expiry window.
**Mitigation**: Short expiry (15 min), IP binding (optional), single-use tokens (advanced).

### Scenario 3: Key Leakage via Memory Dump
**Attack**: Attacker gains shell access to the API server and dumps memory.
**Impact**: Active DEKs may be present in memory.
**Mitigation**: Minimize key lifetime in memory (`dek.fill(0)` after use), run in enclaves (AWS Nitro, Azure Confidential Computing) for high-sensitivity data.

### Scenario 4: Audit Log Tampering
**Attack**: Attacker compromises the database and deletes audit records.
**Impact**: No evidence of the breach.
**Mitigation**: Append-only logs, hash chain, separate security account for log storage.

### Scenario 5: Insider Threat (Rogue Admin)
**Attack**: An admin with database access reads encrypted DEKs.
**Impact**: DEKs are encrypted; admin needs KMS access to decrypt them.
**Mitigation**: Separate KMS admin from application admin. Require MFA for KMS operations. Implement dual-control (two-person rule) for key deletion.

## Data Flow Diagram (DFD)

```
                    ┌──────────────┐
     ┌─────────────│   Attacker   │
     │             └──────────────┘
     │
     ▼
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Client    │─────▶│  API Server  │─────▶│   Object Store  │
│  (Uploader) │      │  (Node.js)   │      │  (S3/MinIO)     │
└─────────────┘      └──────┬───────┘      └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Key Store   │
                     │ (KMS/Vault)  │
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Audit Logger │
                     │ (WORM store) │
                     └──────────────┘
```

## OWASP Top 10 Mapping

| OWASP Top 10 2021 | Relevant Controls |
|---|---|
| A01: Broken Access Control | RBAC, deny-by-default, server-side enforcement |
| A02: Cryptographic Failures | AES-256-GCM, key management, no ECB |
| A03: Injection | Validate `fileId` to prevent path traversal |
| A04: Insecure Design | Threat modeling, least privilege |
| A05: Security Misconfiguration | Secure S3 bucket policies, no public access |
| A06: Vulnerable Components | Dependabot, Snyk, `npm audit` |
| A07: ID and Auth Failures | Strong JWTs, MFA for admin |
| A08: Data Integrity Failures | GCM auth tags, signed URLs |
| A09: Logging Failures | Immutable audit logs |
| A10: SSRF | Validate URLs, block internal IPs in webhooks |
