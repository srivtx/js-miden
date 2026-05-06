# A04 Payment Orchestrator - Deployment

## Docker Deployment

### Build and Run

```bash
docker-compose up --build
```

### Dockerfile

Multi-stage build (production only):
- Node.js 20 Alpine base
- Production dependencies only
- Runs as non-root user

### docker-compose.yml

- Single service configuration
- Health check endpoint
- Persistent volume for data
- Automatic restart policy
- Exposed on port 3001

## Environment Variables

| Variable                  | Default       | Description                          |
|---------------------------|---------------|--------------------------------------|
| NODE_ENV                  | development   | Runtime environment                  |
| PORT                      | 3001          | HTTP server port                     |
| LOG_LEVEL                 | info          | Logging verbosity                    |
| STRIPE_WEBHOOK_SECRET     | whsec_test    | Stripe webhook verification secret   |
| PAYPAL_WEBHOOK_SECRET     | whsec_paypal_test | PayPal webhook verification secret |
| PRIMARY_PROVIDER          | stripe        | Primary payment provider             |
| FALLBACK_ENABLED          | true          | Enable fallback to secondary         |
| CIRCUIT_BREAKER_THRESHOLD | 5             | Failures before opening circuit      |
| CIRCUIT_BREAKER_TIMEOUT   | 30000         | Milliseconds before half-open        |

## Health Checks

The `/health` endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

Docker Compose uses this for container health monitoring.

## Security Considerations

### Webhook Security

1. **Signature Verification**: Each webhook endpoint verifies the provider signature
2. **Provider Validation**: Webhooks include provider field and are validated
3. **Cross-Contamination Prevention**: Payments only updated by their own provider

### Rate Limiting

- Payment creation: 30 requests/minute
- Webhooks: 100 requests/minute

### Input Validation

- Zod schemas validate all inputs
- Amount must be positive and reasonable (< 1M)
- Currency must be 3-letter ISO code
- Email must be valid format

## Production Considerations

### Scalability

Current limitations:
- In-memory only (no persistence)
- Single process
- No horizontal scaling

Recommendations:
1. Add PostgreSQL for payment persistence
2. Use Redis for distributed idempotency keys
3. Implement queue-based payment processing (Bull/BullMQ)
4. Use Kubernetes for horizontal pod autoscaling

### Monitoring

Implemented:
- Morgan for request logging
- Circuit breaker metrics endpoint
- Reconciliation reports

Recommendations:
1. Add Prometheus metrics (payment volume, failure rates)
2. Implement distributed tracing
3. Set up alerts for:
   - High failure rates
   - Circuit breaker opens
   - Reconciliation discrepancies
   - Webhook delivery failures

### PCI Compliance

For production use with real providers:

1. Never store raw card numbers
2. Use provider tokenization (Stripe Tokens, PayPal Vault)
3. Encrypt sensitive data at rest
4. Use TLS 1.3 for all communications
5. Implement audit logging for all payment operations

## Local Development

```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production build
npm start
```

## CI/CD Pipeline

Recommended GitHub Actions workflow:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build
```
