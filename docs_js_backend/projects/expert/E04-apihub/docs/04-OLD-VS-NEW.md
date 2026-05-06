# E04 API Hub: Old vs New (2015 vs 2025)

## 2015 Approach: Monolithic, Manual, Insecure

### Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client    │      │  Monolithic  │      │  Single DB   │
│             │◄────►│  API Server  │◄────►│  (MySQL)     │
└─────────────┘      └──────────────┘      └──────────────┘
```

### Characteristics
- **Monolithic**: Auth, routing, billing, and analytics in one codebase
- **Manual API key management**: Keys stored in database, no rotation, no scopes
- **No rate limiting**: Or rate limiting via Nginx config (per-IP, not per-key)
- **Monthly billing runs**: Cron job that reads logs and generates invoices
- **No developer portal**: API documentation in a static HTML page
- **No analytics**: Apache logs parsed with awk

### Code (2015 Style)
```php
// 2015: PHP monolith, no auth check, no rate limit
$api_key = $_GET['api_key'];
$result = mysql_query("SELECT * FROM apis WHERE key = '$api_key'");
// SQL injection vulnerability included for historical accuracy
$response = file_get_contents($target_url);
echo $response;
```

### Problems
1. One bug in billing takes down the entire platform
2. API keys have no expiration or rotation
3. Rate limiting is coarse (per-IP, not per-key)
4. Usage tracking is batch-processed, not real-time
5. No multi-tenancy; one database, soft deletes

---

## 2025 Approach: Cloud-Native, Event-Driven, Zero-Trust

### Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client    │      │  API Gateway │      │  Backend     │
│             │◄────►│  (Kong/AWS)  │◄────►│  Services    │
└─────────────┘      └──────┬───────┘      └──────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │  Auth   │   │  Usage  │   │ Billing │
        │ (OAuth2)│   │ (Kafka) │   │ (Stripe)│
        └─────────┘   └─────────┘   └─────────┘
```

### Characteristics
- **API Gateway (Kong/AWS/Azure)**: Handles TLS termination, rate limiting, auth, and routing
- **OAuth2 / JWT**: Scoped, expiring tokens with refresh
- **Event-driven usage tracking**: Kafka/Kinesis streams, real-time aggregates
- **Stripe Billing**: Automated invoicing, proration, tax calculation
- **Developer portal**: Self-service API discovery, key management, analytics dashboard
- **Observability**: OpenTelemetry, distributed tracing, Grafana dashboards
- **Zero-trust**: Every service authenticates every request, even internally

### Code (2025 Style)
```typescript
// 2025: Kong gateway plugin + microservices
import { KongPlugin } from '@kong/sdk';

const rateLimitPlugin = new KongPlugin({
  name: 'rate-limiting',
  config: {
    minute: 100,
    policy: 'redis',
    redis_host: 'redis.internal',
    fault_tolerant: true,
  },
});

// Usage tracking via Kafka
producer.send({
  topic: 'api-usage',
  messages: [{
    key: apiKeyId,
    value: JSON.stringify({ apiId, endpoint, responseTimeMs, timestamp }),
  }],
});

// Billing via Stripe
const subscription = await stripe.subscriptions.create({
  customer: developer.stripeCustomerId,
  items: [{ price: tier.stripePriceId }],
  usage_based: true,
});
```

### Evolution Summary

| Aspect | 2015 | 2025 |
|--------|------|------|
| Architecture | Monolith | Microservices / serverless |
| Gateway | Nginx reverse proxy | Kong, AWS API Gateway, Envoy |
| Auth | API key in query string | OAuth2, mTLS, JWT with scopes |
| Rate limiting | Per-IP via Nginx | Per-key via Redis/token bucket |
| Usage tracking | Batch log parsing | Real-time event streaming |
| Billing | Monthly cron job | Stripe/subscription APIs |
| Developer portal | Static HTML | Self-service with analytics |
| Observability | grep / awk | OpenTelemetry, Grafana, Datadog |
| Deployment | FTP to VPS | Kubernetes, GitOps, blue-green |

## What Changed Dramatically

- **API-first companies**: Stripe, Twilio, SendGrid proved that APIs are products, not afterthoughts
- **API marketplaces**: RapidAPI, Postman, and Azure Marketplace made API discovery a business model
- **GraphQL**: Some APIs moved from REST to GraphQL for flexible querying (though REST remains dominant for public APIs)
- **gRPC**: Internal microservices use gRPC for efficiency; REST/GraphQL remains for public APIs
- **AI APIs**: OpenAI, Anthropic, and Hugging Face created a new category of API marketplace

## What Didn't Change

- **Keys will leak**: Rotate them regularly
- **Developers hate breaking changes**: API versioning is forever
- **Documentation is marketing**: The best API docs convert visitors to users
- **Latency matters**: Every 100ms of latency reduces conversion by 1%
