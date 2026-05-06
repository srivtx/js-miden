# E04 API Hub: The Problem

## What Problem Are We Solving?

APIs are the backbone of the digital economy, but monetizing, securing, and managing them at scale is excruciatingly complex. A company with a valuable API faces:

- **No discovery**: Developers can't find the API unless they know about it already
- **No authentication**: Anyone can hit the endpoint. No way to track or throttle usage.
- **No billing**: Providing API access for free destroys margins. Manual invoicing is unscalable.
- **No analytics**: No visibility into who's using what, when, and how much.
- **No governance**: Different teams build APIs with different auth, rate limits, and documentation.

An API Hub (or API Marketplace) solves this by providing:
1. A **developer portal** where APIs are cataloged and documented
2. An **authentication service** that issues and validates API keys
3. A **gateway** that proxies requests, enforces rate limits, and records usage
4. A **usage service** that aggregates calls for analytics and billing
5. A **billing service** that generates invoices based on tiered pricing

## Core Requirements

| Requirement | Why It Matters |
|-------------|---------------|
| **Multi-tenant isolation** | Developer A's API key must never access Developer B's API. A breach of one tenant must not compromise others. |
| **Rate limiting** | Prevent abuse, ensure fair resource sharing, and enforce tier boundaries (free = 100 req/day, pro = 10,000). |
| **Atomic usage tracking** | Concurrent requests must be counted exactly once. Lost updates mean under-billing or over-billing. |
| **Tier enforcement** | A free-tier user must not access pro-tier features or quotas. |
| **Cross-service consistency** | Billing must match usage. Analytics must match billing. Any discrepancy is a financial or legal risk. |

## The Specific Domain: API Marketplace

This platform handles:
- **Developer registration**: Sign up, create profiles, register APIs
- **API key management**: Issue, validate, revoke keys with scopes
- **Request proxying**: Forward authenticated requests to backend APIs
- **Usage metering**: Count requests, track latency, record errors
- **Billing calculation**: Base fee + overage per request

## Real-World Context

- **Stripe**: Processes $1T+ annually. Every API call is authenticated, rate-limited, and billed. Their API design is the industry gold standard.
- **Twilio**: $4B+ revenue from SMS/voice APIs. Usage tracking must be exact to the penny.
- **RapidAPI**: The largest API marketplace. 4M+ developers, 40,000+ APIs. Handles discovery, auth, billing, and analytics.
- **AWS API Gateway**: $3.50/million requests + data transfer. Integrated with CloudWatch, IAM, and billing.
- **Kong / Apigee**: Enterprise API gateways that handle auth, rate limiting, and analytics at Fortune 500 scale.

## Why API Management Is Hard

An API request touches 5+ services:
```
Client → Gateway → Auth Service → Rate Limiter → Backend API
                ↓
         Usage Service → Analytics → Billing
```

Every hop adds latency. Every service is a potential failure point. Every bug is a security or financial vulnerability.

## The Trust Model

```
DEVELOPER A                    API HUB                      DEVELOPER B
───────────                    ───────                      ───────────
   │                              │                              │
   │ Registers "Weather API"      │                              │
   │─────────────────────────────▶│                              │
   │                              │                              │
   │ Creates API key              │                              │
   │─────────────────────────────▶│                              │
   │                              │                              │
   │                              │◀─────────────────────────────│ "I want Weather API"
   │                              │    [Developer B's key]       │
   │                              │                              │
   │                              │ VALIDATE:                    │
   │                              │ - Is key valid?              │
   │                              │ - Does key belong to B?      │
   │                              │ - Is B authorized for A's API?│
   │                              │                              │
   │                              │ 403 FORBIDDEN                │
   │                              │─────────────────────────────▶│
```

The gateway is the gatekeeper. A single missing check = unauthorized access.
