# Security Guide

## Threat Model

### Asset Inventory
- Customer data
- Order history
- Event data
- Financial information

### Threat Actors
- External attackers
- Malicious customers
- Insider threats

### Attack Vectors
- Command injection
- Event replay attacks
- Data tampering
- Unauthorized access

## Security Measures

### 1. Input Validation
```typescript
const placeOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    zipCode: z.string().min(1),
  }),
});
```

### 2. Authorization
```typescript
// Ensure users can only modify their own orders
if (order.customerId !== req.user.id) {
  throw new ForbiddenError('Access denied');
}
```

### 3. Event Integrity
```typescript
// Verify event sequence
const expectedVersion = await eventStore.getCurrentVersion(aggregateId);
if (event.version !== expectedVersion + 1) {
  throw new ConcurrencyError('Version mismatch');
}
```

### 4. Audit Logging
```typescript
console.log(JSON.stringify({
  type: 'command_executed',
  command: 'PlaceOrder',
  aggregateId: result.aggregateId,
  userId: req.user.id,
  timestamp: new Date().toISOString(),
}));
```

### 5. PostgreSQL Security
```sql
-- Use dedicated user
CREATE USER cqrs_app WITH PASSWORD 'strong_password';
GRANT SELECT, INSERT, UPDATE ON event_store TO cqrs_app;
GRANT SELECT, INSERT, UPDATE ON order_read_model TO cqrs_app;
GRANT SELECT, INSERT ON snapshots TO cqrs_app;

-- Enable SSL
ALTER SYSTEM SET ssl = on;
```

### 6. Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

app.use('/orders', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 orders per minute
}));
```

### 7. CORS Configuration
```typescript
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true,
}));
```

## Security Checklist

- [ ] Input validation on all commands
- [ ] Authorization checks
- [ ] Event integrity verification
- [ ] Audit logging enabled
- [ ] PostgreSQL SSL
- [ ] Rate limiting
- [ ] CORS configured
- [ ] API authentication
- [ ] Regular security scans
- [ ] Event store backups

## OWASP Guidelines

1. **Injection Prevention**: Validate all inputs
2. **Access Control**: Proper authorization
3. **Data Integrity**: Event versioning
4. **Audit Trail**: Complete event log

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- PostgreSQL Security: https://www.postgresql.org/docs/current/security.html
- Event Sourcing Security: https://eventstore.com/blog/