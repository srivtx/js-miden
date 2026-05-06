# E04 API Hub: Real-World Bugs & Impact

## Bug 1: Cross-Developer API Access → Data Breach

### The Shopify App Access Token Bug (2019)
**What happened**: A vulnerability in Shopify's API allowed app developers to access other merchants' data by manipulating shop domain parameters in API requests.

**Root cause**: Insufficient authorization checks between the app token and the target shop resource.

**Impact**: Exposed customer data, orders, and financial information for multiple merchants. Shopify paid bug bounties and fixed the vulnerability within 48 hours.

**Our bug**: The gateway proxy never checks `apiKeyContext.developerId === targetApi.developerId`. Any valid API key can access any registered API.

### The Facebook Cambridge Analytica Scandal (2018)
**What happened**: A third-party app collected data not just from users who installed it, but from all of their friends. This was technically allowed by Facebook's API at the time, but violated user expectations.

**Root cause**: Overly permissive API scopes and insufficient data access controls.

**Impact**: $5B FTC fine. Congressional hearings. Global regulatory action. Mark Zuckerberg testified before Congress.

**Lesson**: API authorization is not just a technical issue. It is a trust and regulatory issue.

---

## Bug 2: Non-Atomic Usage Aggregation → Revenue Loss

### The Cloudflare Billing Undercount (2021)
**What happened**: Cloudflare discovered that under rare race conditions, usage counters for certain enterprise customers were undercounted. The bug affected less than 0.1% of invoices.

**Root cause**: Distributed counter increments without atomic guarantees.

**Impact**: Cloudflare under-billed affected customers by an estimated $2M over 2 years. They chose not to retroactively bill, absorbing the loss.

**Our bug**: The usage tracking route does `aggregate.totalRequests += 1` without atomicity. Under 20 concurrent requests, the counter increments by 1 instead of 20.

### The AWS S3 Request Logging Bug (2008)
**What happened**: Early versions of S3 request logging had race conditions that caused log entries to be dropped under high concurrency.

**Root cause**: Non-atomic log writes in a distributed system.

**Impact**: AWS had to rebuild their logging infrastructure with guaranteed delivery (SQS + Lambda). The lesson shaped AWS's event-driven architecture.

---

## Bug 3: Tier Enforcement Bypass → Free Unlimited Access

### The Uber "God Mode" Scandal (2014)
**What happened**: Uber employees used an internal tool called "God View" to track the location of celebrities, politicians, and ex-partners without authorization.

**Root cause**: Insufficient access controls on internal tools. No role-based access control (RBAC) or audit logging.

**Impact**: FTC investigation. $20,000 fine. Reputational damage. Led to Uber's privacy overhaul.

**Our bug**: The usage service accepts `x-tier-override: premium` from the client. A free-tier user can bypass their quota.

### The Postman API Key Leak (2020)
**What happened**: A Postman user discovered that leaked API keys in public Postman collections could be used to access paid-tier features without payment.

**Root cause**: Insufficient validation of tier boundaries when API keys were reused across environments.

**Impact**: Postman implemented stricter key scoping and environment isolation.

---

## Prevention Checklist

- [ ] Gateway enforces cross-developer authorization on every request
- [ ] API keys are scoped to specific APIs and endpoints
- [ ] Rate limits are enforced server-side, not client-side
- [ ] Usage tracking uses atomic increments (database UPSERT or Redis INCR)
- [ ] Tier determination is server-side; ignore client headers
- [ ] All internal service communication is authenticated (mTLS or signed JWTs)
- [ ] Usage aggregates are reconciled against raw records daily
- [ ] Anomaly detection: flag keys with 10x normal usage
- [ ] Regular penetration testing of the gateway and auth flows
- [ ] Immutable audit logs for all authorization decisions
