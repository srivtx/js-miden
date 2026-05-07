# M01 Hello API: Red Team

## Attack Scenarios

Your logging endpoint is not a security boundary — until it becomes one. Here is how an attacker weaponizes your logs.

---

## Attack 1: Log Injection

### The Vector

The attacker sends this request:

```http
GET /search?q=hello%0a2024-01-15T09:00:00.000Z%20POST%20/admin/delete-all%20200%200%0a HTTP/1.1
```

The URL-decoded query string contains newlines:

```
hello
2024-01-15T09:00:00.000Z POST /admin/delete-all 200 0
```

### The Exploit

Your log file now contains a forged entry:

```
2024-01-15T09:23:47.123Z GET /search?q=hello
2024-01-15T09:00:00.000Z POST /admin/delete-all 200 0
 HTTP/1.1 200 5
```

During a post-incident review, an auditor sees the forged line and believes an admin deleted data. The attacker creates false evidence, or worse, injects control characters that break downstream log parsers.

### The Defense

Sanitize every user-controlled field before writing:

```javascript
function sanitizeForLog(str) {
  return String(str)
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

const line = `${timestamp} ${sanitizeForLog(method)} ${sanitizeForLog(url)} ${statusCode} ${duration}\n`;
```

Even better: output structured logs (JSON) and let the serializer handle escaping.

---

## Attack 2: Log Flooding (Denial of Storage)

### The Vector

The attacker has valid credentials. They script a loop that hits an authenticated endpoint 100,000 times per second.

### The Exploit

Your logs grow at 100,000 lines per second. If each line is 80 bytes, that is 8 MB/s. In 24 hours, that is 691 GB. Your disk fills. Your log aggregator costs explode. Your retention policy forces deletion of older logs — including the evidence of the attacker's earlier, more subtle intrusion.

### The Defense

1. **Rate limit per IP + user**: Block before the request reaches the route handler.
2. **Log sampling for high-cardinality endpoints**: Log 1% of health checks, 10% of search queries.
3. **Size-based alerting**: Alert when log volume exceeds a baseline by 5x.
4. **Separate audit logs**: Security-critical events (auth, admin actions) go to a separate, append-only stream with strict retention.

---

## Attack 3: Sensitive Data Exfiltration via Logs

### The Vector

A developer adds debugging:

```javascript
console.log('Login attempt:', req.body);
```

The request body contains:

```json
{
  "email": "user@example.com",
  "password": "SuperSecret123!",
  "ssn": "123-45-6789"
}
```

### The Exploit

Logs are often the least protected data store. They are shipped to third-party services (Splunk, Datadog, CloudWatch). They are accessible to every engineer with "read-only" access. An attacker who gains read access to logs now has plaintext passwords and SSNs for every user.

### The Defense

1. **Never log raw request bodies**.
2. **Redact known sensitive fields**:
   ```javascript
   const SENSITIVE_FIELDS = ['password', 'token', 'ssn', 'creditCard'];
   function redact(body) {
     const clone = { ...body };
     for (const key of SENSITIVE_FIELDS) {
       if (clone[key]) clone[key] = '[REDACTED]';
     }
     return clone;
   }
   ```
3. **Use allowlists, not denylists**: Only log fields you explicitly want.
4. **Encrypt logs at rest** and restrict access with IAM.

---

## Red Team Summary

| Attack | Impact | Defense |
|--------|--------|---------|
| Log Injection | False evidence, parser breakage | Sanitize newlines, use structured JSON |
| Log Flooding | Disk exhaustion, cost explosion, evidence loss | Rate limiting, sampling, size alerts |
| Sensitive Data Leak | Credential exposure, regulatory fine | Redaction, allowlists, encryption, IAM |

## The Meta-Attack

The most dangerous attacker knows that logs are trusted. If I can write to your logs, I can write your incident response. If I can read your logs, I can read your secrets. Treat logs as a data store with the same security rigor as your database.
