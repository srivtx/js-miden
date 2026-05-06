# 04-OLD-VS-NEW.md

## 2015 Patterns vs 2025 Patterns

### Assignment

**2015: Cookie-Based**
```javascript
// Fragile, users clear cookies, not cross-device
const variant = req.cookies[`exp_${experimentName}`] || pickVariant();
res.cookie(`exp_${experimentName}`, variant);
```

**2025: User ID Hash + Edge Computing**
```typescript
// Deterministic, works everywhere, computed at CDN edge
// Cloudflare Workers / Fastly VCL:
set req.http.X-Variant = hash(req.http.User-Id + ":" + req.http.Experiment) % 100;
```

**2025: Feature Flags with Experiment Context**
```typescript
// LaunchDarkly, Split.io integrate A/B tests into feature flags
const variant = await ldClient.variation('button-color', user, 'control');
```

### Analysis

**2015: Manual Excel / SQL Queries**
```sql
-- Analyst runs queries manually, prone to errors
SELECT variant, COUNT(*), SUM(converted) 
FROM experiment_data 
WHERE experiment = 'button-color'
GROUP BY variant;
```

**2025: Automated Sequential Testing**
```typescript
// Always-valid p-values allow peeking without inflating false positives
import { SequentialTest } from 'sequential-testing-lib';
const result = sequentialTest.analyze(controlStream, treatmentStream);
```

**2025: CUPED (Controlled-experiment Using Pre-Experiment Data)**
```typescript
// Reduces variance by 30-50% using pre-experiment covariates
const cupedMetric = rawMetric - theta * (preExperimentMetric - meanPreExp);
// Same sample size, higher power. Or same power, smaller sample size.
```

### Infrastructure

**2015: Monolithic Assignment Service**
```
Frontend -> Backend API -> Database (assignments table)
```

**2025: Edge-Assigned, Event-Streamed**
```
CDN Edge (assignment) -> Kafka (exposures + conversions) -> Flink (real-time stats)
```

### Metrics

**2015: Single Metric (CTR)**
```javascript
// Only tracking clicks. Missing the bigger picture.
```

**2025: Guardrail + Counterfactual + Long-Term**
```typescript
metrics = {
  primary: 'purchase_rate',
  guardrails: ['page_load_ms', 'bounce_rate', 'support_tickets'],
  counterfactual: 'would_user_have_converted_anyway?',
  longTerm: 'retention_at_30_days',
};
```

### Ethics and Bias

**2015: No Ethics Review**
```javascript
// Any experiment could run without oversight
```

**2025: Experiment Review Boards**
```
- IRB-style review for sensitive experiments
- Automatic detection of demographic bias
- PII protection in experiment data
- Mandatory power analysis before launch
```

### Platform Architecture

```
2015: Custom Built
┌─────────────────────────────────────┐
│  Company-specific A/B test system   │
│  (fragile, under-maintained)        │
└─────────────────────────────────────┘

2025: Vendor Platforms + Custom Pipelines
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Feature Flag│     │  Event       │     │  Stats       │
│  Platform    │────>│  Warehouse   │────>│  Engine      │
│  (LaunchDarkly)     │  (Snowflake) │     │  (Internal)  │
└──────────────┘     └──────────────┘     └──────────────┘
```
