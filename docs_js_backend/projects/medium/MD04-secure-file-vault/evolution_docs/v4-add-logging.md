# MD04 Secure File Vault — v4 Adding Logging

## The Incident

Compliance calls: "Who downloaded the payroll file last Tuesday?" You check... nothing. You have no audit trail. The SOC 2 auditor frowns. Your certification is at risk.

Then a user reports: "My file is gone." You check the filesystem. The file was deleted. By whom? When? You have no idea. Was it a bug? A breach? An angry employee?

## The Fix: Immutable Audit Logs

```ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization'],
});

export function logFileAccess(
  action: 'upload' | 'download' | 'share' | 'delete',
  fileId: string,
  userId: string,
  ip: string,
  metadata?: Record<string, unknown>
) {
  logger.info({
    event: 'file_access',
    action,
    fileId,
    userId,
    ip,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
}
```

### Tamper-Resistant Audit Trail

```ts
// Audit logs go to a separate append-only table AND external SIEM
async function appendAuditLog(entry: FileAccessLog): Promise<void> {
  // Local audit table (WORM: Write Once Read Many)
  await db.query(
    `INSERT INTO audit_logs (file_id, user_id, action, ip, timestamp, checksum)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entry.fileId, entry.userId, entry.action, entry.ip, entry.timestamp, await computeLogChecksum(entry)]
  );

  // External SIEM for compliance
  siemClient.send({
    index: 'file-vault-audit',
    body: entry,
  }).catch(err => {
    logger.error({ event: 'siem_send_failed', error: err.message });
  });
}

async function computeLogChecksum(entry: FileAccessLog): Promise<string> {
  const data = JSON.stringify({ ...entry, checksum: undefined });
  return crypto.createHmac('sha256', process.env.AUDIT_SECRET!).update(data).digest('hex');
}
```

### Logging Every Operation

```ts
async function download(fileId: string, userId: string, req: Request): Promise<Readable> {
  const start = Date.now();
  const file = await getFile(fileId);

  if (file.ownerId !== userId) {
    logFileAccess('download', fileId, userId, req.ip, {
      success: false,
      reason: 'unauthorized',
      durationMs: Date.now() - start,
    });
    throw new Error('Unauthorized');
  }

  logFileAccess('download', fileId, userId, req.ip, {
    success: true,
    filename: file.filename,
    size: file.size,
    durationMs: Date.now() - start,
  });

  await appendAuditLog({
    fileId,
    userId,
    action: 'download',
    timestamp: new Date(),
    ip: req.ip,
  });

  return createDecryptedStream(file);
}
```

### Access Pattern Detection

```ts
// Background job: detect unusual access
async function detectAnomalies() {
  const anomalies = await db.query(`
    SELECT user_id, COUNT(*) as download_count, COUNT(DISTINCT file_id) as unique_files
    FROM audit_logs
    WHERE action = 'download'
      AND timestamp > NOW() - INTERVAL '1 hour'
    GROUP BY user_id
    HAVING COUNT(*) > 100
  `);

  for (const row of anomalies.rows) {
    logger.warn({
      event: 'anomalous_access_detected',
      userId: row.user_id,
      downloadCount: row.download_count,
      uniqueFiles: row.unique_files,
      action: 'alert_sent_to_security_team',
    });
  }
}
```

## Observability: What to Log

| Event | Why |
|-------|-----|
| `file_access` | Every read/write operation |
| `upload_complete` | File ingestion tracking |
| `download_complete` | Data exfiltration detection |
| `share_created` | Third-party access audit |
| `delete_complete` | Data retention compliance |
| `anomalous_access_detected` | Insider threat detection |

## The Dashboard Query

```sql
-- Files accessed by terminated employees
SELECT a.file_id, a.user_id, a.action, a.timestamp
FROM audit_logs a
JOIN users u ON a.user_id = u.id
WHERE u.status = 'terminated'
  AND a.timestamp > u.termination_date
ORDER BY a.timestamp DESC;
```

## The Bug

You store audit logs in the same database as files. A DBA with `DELETE` privileges can wipe the audit trail. Compliance requires separation of duties.

**Fix:** Ship audit logs to an immutable store (AWS S3 with Object Lock, or a separate SIEM) in real-time.

**Next:** Let's write tests so we can prove encryption and access control work correctly.
