# M13 Request Logger: The Incident

## 2:47 AM — The Security Pager

You are the on-call security engineer. Your phone erupts with a SEV-1 alert from the SIEM:

> **CRITICAL:** Credential exposure detected in log aggregation pipeline. 2.3M log lines contain plaintext passwords.

You open Splunk and run the query that triggered the alert:

```
index=production "password"
```

The result count makes your stomach drop: **2,341,892 hits** in the last 7 days.

## The Smoking Gun

You drill into a single log line:

```json
{
  "timestamp": "2024-03-15T02:47:12.341Z",
  "level": "info",
  "method": "POST",
  "path": "/api/v1/login",
  "status": 200,
  "duration": 45,
  "body": {
    "username": "admin@company.com",
    "password": "SuperSecret123!",
    "rememberMe": true
  },
  "headers": {
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
  }
}
```

The request logger was added three weeks ago by a junior developer who wanted "complete request traces for debugging." It logs the entire `req.body` and `req.headers` objects without redaction.

## The Blast Radius

| System | Exposure |
|--------|----------|
| Splunk | 2.3M lines indexed, searchable by any engineer with read access |
| S3 archive | 47 GB of uncompressed logs with plaintext credentials |
| Datadog | 12M metric tags derived from log parsing, some containing password length metadata |
| Support tickets | 3 support staff have run Splunk queries containing user passwords this month |

## The Regulatory Clock

GDPR Article 32 requires "appropriate technical and organisational measures" to protect personal data. Logs are "at rest." Your legal team informs you:

- You must notify affected users within 72 hours.
- You must prove you have contained the exposure.
- You must demonstrate the fix prevents recurrence.

## The Fix (Hidden)

<details>
<summary>Click to reveal</summary>

1. **Immediately disable the logger** to stop new exposure:
   ```typescript
   // middleware/logger.ts
   export function requestLogger(req, res, next) {
     // DISABLED — credential exposure incident
     next();
   }
   ```

2. **Scrub existing logs** using Splunk's `delete` command and S3 object versioning:
   ```bash
   # Mark all production index logs from the past 21 days for deletion
   | delete index=production earliest=-21d@d
   ```

3. **Implement recursive redaction**:
   ```typescript
   const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey', 'ssn'];

   function redact(obj: unknown): unknown {
     if (obj === null || typeof obj !== 'object') return obj;
     if (Array.isArray(obj)) return obj.map(redact);

     const clone: Record<string, unknown> = {};
     for (const [key, value] of Object.entries(obj)) {
       clone[key] = SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))
         ? '[REDACTED]'
         : redact(value);
     }
     return clone;
   }
   ```

4. **Add a security test** that fails if any log line contains a sensitive field:
   ```typescript
   it('should NEVER log sensitive fields', async () => {
     const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
     await request(app).post('/login').send({ username: 'admin', password: 'secret' });
     const logArg = JSON.parse(logSpy.mock.calls[0][0] as string);
     expect(JSON.stringify(logArg)).not.toMatch(/"password"/i);
     logSpy.mockRestore();
   });
   ```

5. **Rotate all exposed credentials** and notify users.

</details>

## Post-Incident Review

| Question | Answer |
|----------|--------|
| Why did this happen? | A developer logged `req.body` directly without redaction, assuming logs were "internal only." |
| Why didn't tests catch it? | There was no security test asserting the absence of sensitive data in logs. |
| Why didn't code review catch it? | The PR was +3 lines and was rubber-stamped. No security checklist was applied. |
| What monitoring gap existed? | The SIEM alert was a custom rule added after a pen test. It was not default. |

## The Real Lesson

> **Logs are a data store. Treat them like one.**
>
> They have storage, access control, retention policies, and encryption requirements — just like your database. The only difference is that developers think of logs as "temporary" and "internal." They are neither. Logs outlive engineers, outlive projects, and often outlive the company that generated them.

A single unredacted field is not a bug. It is a breach.
