# Security Guide

## Threat Model

### Asset Inventory
- Event data
- Aggregated metrics
- Redis data
- PostgreSQL data

### Threat Actors
- External attackers
- Malicious clients
- Insider threats

### Attack Vectors
- Event injection
- DoS via large batches
- Redis injection
- Data exfiltration

## Security Measures

### 1. Input Validation
```typescript
const eventSchema = z.object({
  eventType: z.string().min(1).max(100),
  payload: z.record(z.unknown()).default({}),
  source: z.string().min(1).max(200).default('api'),
});
```

### 2. Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

app.use('/events', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10000, // 10k requests per minute
}));
```

### 3. Batch Size Limits
```typescript
if (rawEvents.length > config.eventBatchSize) {
  return res.status(400).json({
    error: `Batch size exceeds maximum of ${config.eventBatchSize}`,
  });
}
```

### 4. Request Size Limits
```typescript
app.use(bodyParser.json({ limit: '1mb' }));
```

### 5. Redis Security
```bash
# Enable AUTH
redis-cli CONFIG SET requirepass yourpassword

# Bind to localhost only
redis-cli CONFIG SET bind 127.0.0.1

# Disable dangerous commands
redis-cli CONFIG SET rename-command FLUSHDB ""
redis-cli CONFIG SET rename-command FLUSHALL ""
```

### 6. PostgreSQL Security
```sql
-- Use dedicated user
CREATE USER analytics WITH PASSWORD 'strong_password';
GRANT SELECT, INSERT ON events TO analytics;
GRANT SELECT ON metric_rollups TO analytics;

-- Enable SSL
ALTER SYSTEM SET ssl = on;
```

### 7. CORS Configuration
```typescript
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true,
}));
```

### 8. API Key Authentication
```typescript
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

app.use('/events', apiKeyMiddleware);
```

## Security Checklist

- [ ] Input validation active
- [ ] Rate limiting enabled
- [ ] Batch size limits set
- [ ] Request size limits set
- [ ] Redis password protected
- [ ] PostgreSQL SSL enabled
- [ ] CORS configured
- [ ] API keys for ingestion
- [ ] Audit logging enabled
- [ ] Regular security scans

## OWASP Guidelines

1. **Injection Prevention**: Validate all inputs
2. **DoS Prevention**: Rate limiting and batch limits
3. **Data Integrity**: Atomic operations for counters
4. **Access Control**: API keys and CORS

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Redis Security: https://redis.io/docs/management/security/
- PostgreSQL Security: https://www.postgresql.org/docs/current/security.html