# 06-BUGS.md

## Real-World Bug Impact

### Bug 1: Not Idempotent

**WHAT**: The `load()` function appends records to an array without checking for duplicates. Re-running the pipeline creates duplicate entries.

**Real-World Impact**:

- **Target Financial Reporting (2013)**: A nightly ETL pipeline ingested sales transactions into the data warehouse. A network blip caused the pipeline to fail at 2 AM. The ops team re-ran it at 3 AM without truncating the destination table. All 2.4M transactions were duplicated. The CFO's morning report showed double revenue. The error wasn't caught for 6 hours, causing erroneous investor communications and a stock price dip.

- **Stripe Data Pipeline (2017)**: A backfill job reprocessing 30 days of payment events was run twice due to a deployment script bug. The downstream fraud model trained on duplicated data, causing false positive rates to spike by 40% for 2 days.

- **Theoretical Impact**:
```
Scenario: User Analytics Dashboard

Pipeline runs daily at midnight:
  Day 1: 1,000 users loaded
  Day 2: 1,050 users loaded (including 50 new)
  
Without idempotency:
  Day 2 total in DB: 1,000 + 1,050 = 2,050 rows
  Unique users: 1,050
  Dashboard shows: 2,050 "active users" (WRONG!)
  
With idempotency (UPSERT):
  Day 2 total in DB: 1,050 rows
  Unique users: 1,050
  Dashboard shows: 1,050 active users (CORRECT)
```

**How to Detect in Production**:
- Row count anomalies (sudden 2x increase)
- Duplicate primary key reports from BI tools
- `SELECT id, COUNT(*) FROM users GROUP BY id HAVING COUNT(*) > 1`
- Data diff between source and destination

**WRONG vs RIGHT**:
```typescript
// WRONG: Blind append
function load(records) {
  const existing = db.getAll();
  db.save([...existing, ...records]);  // Duplicates on re-run!
}

// RIGHT: UPSERT by primary key
function load(records) {
  for (const record of records) {
    db.upsert({
      where: { id: record.id },
      update: record,
      create: record,
    });
  }
}
```

### Bug 2: No Error Isolation

**WHAT**: The `load()` function validates all records in a loop before saving any. The first invalid row throws an error, killing the entire batch.

**Real-World Impact**:

- **Healthcare Data Migration (2019, anonymized)**: A hospital migrating 500K patient records to a new EHR system used an all-or-nothing batch approach. Record #247,891 had an invalid date format (`02/30/2019`). The entire batch failed. Because the pipeline was not idempotent either, re-running it duplicated the first 247,890 records. It took 3 days to clean up the data.

- **E-commerce Inventory Sync**: A product catalog pipeline failed because one supplier provided a SKU with an em dash instead of a hyphen. The entire night's inventory update was lost. The website showed "out of stock" for 12,000 products for 8 hours. Estimated revenue loss: $180K.

**How to Detect in Production**:
- Pipeline failure rate spikes
- Partial data in destination (some days have data, others don't)
- Support tickets about missing/missing data
- Manual intervention logs (engineers re-running pipelines)

**WRONG vs RIGHT**:
```typescript
// WRONG: All-or-nothing
function load(records) {
  for (const record of records) {
    validate(record);  // Throws = everything lost
  }
  saveAll(records);
}

// RIGHT: Per-row isolation
function load(records) {
  const results = { processed: 0, failed: 0, errors: [] };
  
  for (const record of records) {
    try {
      validate(record);
      save(record);
      results.processed++;
    } catch (error) {
      results.failed++;
      results.errors.push({ id: record.id, error: error.message });
      logToDeadLetterQueue(record, error);
    }
  }
  
  return results;
}
```

### Additional Production Bugs Not In This Codebase

- **Schema Drift**: Source adds a new column. Pipeline crashes because it expects 4 columns, finds 5.
- **Silent Data Loss**: Pipeline reports "success" but 0 rows loaded. No alerting on row count = 0.
- **Timezone Hell**: Source timestamps are UTC, transform assumes local time, reports show shifted dates.
- **Encoding Issues**: Source CSV is UTF-8 with BOM. Parser treats BOM as part of first column name.
- **Memory Exhaustion**: Loading a 10GB CSV into memory crashes the Node process. Streaming is required.
