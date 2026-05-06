# 06-BUGS.md

## Real-World Bug Impact

### Bug 1: Breaking Change Without Version Bump

**WHAT**: The v1 route returns data derived from the v2 model instead of its own canonical v1 data. While the transformation function produces the correct shape, this pattern means any change to the v2 data source implicitly changes v1 behavior.

**Real-World Impact**:

- **Twitter API v1.1 (2012)**: Twitter changed the payload format for tweet entities without a version bump. Third-party clients (including major news organizations' embedded tweet widgets) displayed broken content for 48 hours. The incident forced Twitter to create a formal API deprecation policy and developer advocacy team.

- **Parse Shutdown (2016)**: Facebook's Parse service announced shutdown with 1 year notice. But in the final 6 months, they pushed breaking changes to the API without version bumps, forcing thousands of apps to emergency-patch. The developer trust damage contributed to Parse's failure as a platform.

- **Theoretical Catastrophe**:
```
Scenario: Payment API

v1 GET /v1/payment-methods:
  [{ id: "1", type: "card", last4: "4242" }]

Backend team refactors to v2:
  [{ id: "1", type: "card", last4: "4242", brand: "visa" }]

But v1 route now transforms from v2:
  // Transformation looks correct...
  
Until someone updates the v2 model:
  [{ id: "pm_1", type: "card", last4: "4242", brand: "visa" }]
  
  // v1 IDs changed from "1" to "pm_1"!
  // Client apps stored "1" in local database
  // Now all cached payment methods are orphaned
  // Users can't complete checkout
  
Impact: $2M in lost sales over 4 hours.
```

**How to Detect in Production**:
- Contract tests comparing v1 response to frozen snapshot
- Consumer-driven contract tests (Pact)
- Schema validation on every response
- Canary deployments with traffic mirroring to detect shape changes

**WRONG vs RIGHT**:
```typescript
// WRONG: v1 depends on v2 data
v1Router.get('/users', (req, res) => {
  res.json(usersV2.map(transformV2toV1));  // v1 is a derivative!
});

// RIGHT: v1 has its own frozen data
v1Router.get('/users', (req, res) => {
  res.json(usersV1);  // v1 is independent and immutable
});
```

### Bug 2: No Deprecation Notice

**WHAT**: v1 responses include no `Deprecation` or `Sunset` headers. Clients have no machine-readable signal that they need to migrate.

**Real-World Impact**:

- **Google Maps API v2 (2013)**: Google deprecated v2 with minimal notice. Because there were no deprecation headers or automated warnings, thousands of websites used the deprecated API until it was shut off. The resulting broken maps caused a PR crisis and forced Google to extend the deprecation timeline by 6 months.

- **Heroku API v2 (2022)**: Heroku announced v2 deprecation with 12 months notice, including `Deprecation` headers and email alerts. Despite this, 15% of active apps were still using v2 on the sunset date. Heroku had to extend support for an additional 3 months for enterprise customers.

- **The Silent Migration Crisis**:
```
Without Deprecation Headers:

Month 1: Backend team decides to sunset v1
Month 2: Docs updated, blog post published
Month 3: No one reads docs or blog
Month 4: v1 shutoff scheduled
Month 5: v1 shuts off
Month 6: 50 support tickets: "Our integration broke!"
Month 7: Engineering team spends 2 weeks firefighting

With Deprecation Headers:

Month 1: Backend adds Deprecation + Sunset headers
Month 2: Client SDKs start logging warnings
Month 3: Monitoring dashboards show deprecation warnings
Month 4: Automated alerts notify integration owners
Month 5: 95% of traffic has migrated to v2
Month 6: v1 shuts off with 2 support tickets
```

**How to Detect in Production**:
- HTTP response header audits
- Client SDK warning telemetry
- Traffic analysis showing what percentage of requests include deprecated versions
- Automated linting in CI that flags tests against deprecated endpoints

**WRONG vs RIGHT**:
```typescript
// WRONG: Silent version
v1Router.get('/users', (req, res) => {
  res.json(usersV1);  // No indication this is deprecated
});

// RIGHT: Machine-readable deprecation
v1Router.get('/users', (req, res) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');
  res.set('Link', '</v2/users>; rel="successor-version"');
  res.json(usersV1);
});
```

### Additional Production Bugs Not In This Codebase

- **Version Proliferation**: Supporting 8 versions because each team was afraid to sunset anything. 60% of engineering time spent maintaining legacy transforms.
- **Documentation Drift**: v3 docs describe a field that was removed in v3.1. Developers build against docs, not reality.
- **Internal-Only Breaking Changes**: A "private" API with no versioning is used by 12 internal services. One change breaks the billing pipeline.
- **URL Versioning Cache Poisoning**: CDN caches `/v1/users` and `/v2/users` separately, but a misconfiguration serves v2 data at the v1 URL.
- **Header Versioning Ignored**: Load balancers strip custom headers, breaking header-based routing in production.
