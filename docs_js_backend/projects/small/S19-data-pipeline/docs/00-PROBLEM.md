# 00-PROBLEM.md

## WHAT Problem Does a Data Pipeline Solve?

Business data lives in fragments. Customer signups are in PostgreSQL. Clickstream logs are in S3. Support tickets are in Zendesk. Sales data is in Salesforce. Analysts spend 80% of their time finding, cleaning, and joining data instead of deriving insights. Every report is a bespoke SQL nightmare.

**The Core Problem**: Data is trapped in silos and incompatible formats

```
Data Chaos:

Source A: PostgreSQL users table
  id | name  | email           | created_at
  ---|-------|-----------------|------------
  1  | Alice | alice@email.com | 2024-01-15

Source B: CSV from marketing
  user_id,full_name,email_address,signup_date
  1,Alice Smith,alice@email.com,01/15/2024

Source C: API JSON
  { "customer": { "id": "usr_1", "display_name": "Alice", "contact": "alice@email.com" } }

Analyst Query: "How many users signed up in January?"
  -> Join 3 sources with different schemas
  -> Handle different date formats
  -> Deduplicate Alice appearing in all 3
  -> 4 hours of SQL later... maybe correct?
```

## WHY This Matters

- **Decision Latency**: CEOs ask questions that take engineering teams 2 weeks to answer
- **Data Quality**: Inconsistent formats lead to garbage reports and wrong decisions
- **Regulatory Compliance**: GDPR requires knowing WHERE all user data lives
- **ML Pipelines**: Models need clean, consolidated data feeds
- **Operational Efficiency**: Automated pipelines replace manual CSV exports

## HOW ETL/ELT Addresses It

Extract data from sources, Transform it into a consistent format, Load it into a destination.

```
ETL Pipeline:

Extract          Transform           Load
-------          ---------           ----
PostgreSQL  ->   Validate      ->   Data Warehouse
S3 CSV      ->   Normalize     ->   (Snowflake)
API JSON    ->   Deduplicate   ->
Zendesk     ->   Enrich        ->

Result: Single source of truth for analytics
```

But data pipelines introduce NEW problems:
1. **Not Idempotent**: Re-running a pipeline creates duplicate records
2. **No Error Isolation**: One malformed CSV row crashes the entire batch
3. **Schema Drift**: Source adds a column, pipeline breaks
4. **Late Arriving Data**: Yesterday's logs arrive today — how to backfill?
5. **Silent Failures**: Pipeline "succeeds" but loaded 0 rows

## WRONG vs RIGHT

| Aspect | WRONG (Ad-hoc Script) | RIGHT (Production Pipeline) |
|--------|----------------------|----------------------------|
| Trigger | Manual `node import.js` | Scheduled / event-driven |
| Errors | Crash on first bad row | Per-row error isolation + dead letter queue |
| Idempotency | INSERT only | UPSERT / MERGE with primary keys |
| Monitoring | Console.log | Structured metrics, alerting |
| Schema | Hard-coded indexes | Schema registry, auto-evolution |

## Real-World Impact

- **Airbnb (2014)**: Built Airflow (now Apache Airflow) to manage 10,000+ daily ETL jobs. Reduced data pipeline failures by 70%.
- **Netflix**: Keystone pipeline processes 500B events/day. A single hour of downtime corrupts recommendation models.
- **Uber (2016)**: Michelangelo platform requires real-time feature pipelines. Non-idempotent pipelines caused model retraining from stale data.
- **Target (2013)**: A data pipeline bug duplicated transaction records, causing $5M in incorrect financial reporting.
