# Audit Logging

## Why Audit Logging Matters
- **Compliance**: SOC 2, ISO 27001, HIPAA, and GDPR require access logs
- **Incident response**: When a breach occurs, logs tell you who accessed what and when
- **Deterrence**: Users are less likely to abuse access if actions are logged
- **Forensics**: Immutable logs provide court-admissible evidence

## What to Log

| Event | Fields | Example |
|---|---|---|
| `file.uploaded` | actor, fileId, size, checksum, timestamp | `alice uploaded file#123 (2.3 MB)` |
| `file.downloaded` | actor, fileId, ipAddress, userAgent, timestamp | `bob downloaded file#123 from 192.168.1.1` |
| `file.shared` | actor, fileId, targetUser, permission, timestamp | `alice shared file#123 with bob (read)` |
| `file.deleted` | actor, fileId, timestamp | `alice deleted file#123` |
| `url.generated` | actor, fileId, expiry, ipAddress | `bob generated pre-signed URL for file#123` |
| `access.denied` | actor, fileId, reason, timestamp | `carol denied access to file#123 (no permission)` |
| `key.rotated` | actor, fileId, oldKeyVersion, newKeyVersion | `system rotated key for file#123` |

## Log Format (Structured JSON)

```json
{
  "timestamp": "2024-01-15T09:23:47.123Z",
  "event": "file.downloaded",
  "severity": "info",
  "actor": {
    "type": "user",
    "id": "user_abc123",
    "email": "alice@example.com"
  },
  "resource": {
    "type": "file",
    "id": "file_xyz789",
    "name": "contract.pdf",
    "size": 2048000
  },
  "context": {
    "ip": "203.0.113.42",
    "userAgent": "Mozilla/5.0...",
    "requestId": "req_998877"
  },
  "outcome": "success"
}
```

## Immutability & Tamper Evidence

Logs must be **append-only** and tamper-evident.

### Strategy 1: Write-Once Storage (WORM)
Use AWS S3 Object Lock or MinIO bucket versioning with legal hold.

### Strategy 2: Hash Chain
Each log entry contains the hash of the previous entry. Tampering breaks the chain.

```
Log Entry N:   { ..., prevHash: "0xabc...", hash: "0xdef..." }
                              │
                              ▼
Log Entry N+1: { ..., prevHash: "0xdef...", hash: "0x123..." }
```

```typescript
import { createHash } from 'crypto';

interface AuditLog {
  timestamp: string;
  event: string;
  data: object;
  prevHash: string;
  hash: string;
}

function hashLog(entry: Omit<AuditLog, 'hash'>): string {
  return createHash('sha256')
    .update(JSON.stringify(entry))
    .digest('hex');
}

async function appendLog(event: string, data: object, prevHash: string) {
  const entry: AuditLog = {
    timestamp: new Date().toISOString(),
    event,
    data,
    prevHash,
    hash: '', // placeholder
  };
  entry.hash = hashLog(entry);
  await db.auditLog.create({ data: entry });
  return entry.hash;
}
```

### Strategy 3: Separate Security Account
Store logs in a cloud account or database that the application server **cannot write to** after the fact. Use a log forwarder (e.g., AWS Kinesis, Fluentd) that runs with distinct credentials.

## Querying & Alerting

```sql
-- Failed access attempts in the last hour
SELECT actor_id, COUNT(*) as attempts
FROM audit_log
WHERE event = 'access.denied'
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY actor_id
HAVING COUNT(*) > 5;
```

**Alerts**:
- > 5 denied attempts in 1 minute → possible brute force
- Download from a new country → possible account takeover
- Bulk download of > 100 files → possible data exfiltration

## OWASP Reference
> "Audit logs should be protected from unauthorized access and modification. Logs should be sent to a separate, hardened system that the application cannot modify." — OWASP Logging Cheat Sheet

> "Log all authentication attempts, access control failures, and input validation failures with sufficient context to identify suspicious activity." — OWASP Application Security Verification Standard (ASVS) V7.1
