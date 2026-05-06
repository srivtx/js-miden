# 01-THINKING.md

## Design Thinking: Data as a Product

A data pipeline is not just a script. It's a production system with SLAs, monitoring, and error handling as rigorous as any customer-facing API.

### The Data Journey

```
Raw Data -> Clean Data -> Analytics -> Decisions -> Actions -> New Raw Data
     ^__________________________________________________________|
```

Every step in this loop must be reliable. If the pipeline fails, decisions are made on stale data.

### Batch vs Streaming Thinking

**Batch Processing (This Project)**:
```
Every hour: Extract -> Transform -> Load
Pros: Simple, replayable, cost-effective
Cons: Data is stale by up to 1 hour
Use case: Daily reports, financial reconciliation
```

**Stream Processing (Modern)**:
```
Real-time: Extract -> Transform -> Load (continuous)
Pros: Near real-time insights
Cons: Complex, expensive, harder to debug
Use case: Fraud detection, real-time recommendations
```

### The Idempotency Mindset

The most important question in pipeline design: "What happens if I run this twice?"

```
WRONG Thinking:
  "I'll just delete the destination table and re-run"
  Problem: Downtime, lost historical data, race conditions

RIGHT Thinking:
  "Every run produces the exact same output given the same input"
  Solution: UPSERT on primary keys, deterministic transforms
```

### Error Isolation Thinking

```
WRONG: All-or-nothing
  Batch of 10,000 rows
  Row #9,999 has invalid email
  -> ENTIRE batch fails
  -> 9,998 valid rows are lost
  -> Data is incomplete for the day

RIGHT: Fail fast, save details
  Batch of 10,000 rows
  Row #9,999 has invalid email
  -> Log error for row 9,999
  -> Save 9,999 valid rows
  -> Quarantine bad row for manual review
  -> Pipeline succeeds with partial load
```

### Schema Evolution Thinking

Data sources change. Your pipeline must not break.

```
Source Schema V1:
  id, name, email

Source Schema V2 (source adds phone):
  id, name, email, phone

WRONG Pipeline:
  INSERT INTO users (id, name, email) VALUES (?, ?, ?)
  -> Breaks because CSV now has 4 columns

RIGHT Pipeline:
  1. Parse with headers -> object
  2. Validate known fields
  3. Ignore unknown fields (or log them)
  4. Load known fields
  5. Alert that new field 'phone' was detected
```

### Data Quality Thinking

Trust in data is earned through validation at every stage.

```
Pre-Load Checks:
  - Row count matches source
  - No NULLs in required fields
  - Email format valid
  - Age > 0 and < 150

Post-Load Checks:
  - Destination row count = source row count - failures
  - No duplicate primary keys
  - Referential integrity maintained
  - Distribution looks reasonable (no all-male dataset)
```
