# 04-OLD-VS-NEW.md

## 2015 Patterns vs 2025 Patterns

### Orchestration

**2015: Cron Jobs + Bash Scripts**
```bash
# Fragile, no dependency management, silent failures
0 2 * * * /usr/bin/node /app/pipeline.js >> /var/log/pipeline.log 2>&1
```

**2025: Apache Airflow / Dagster / Prefect**
```python
# DAG with dependencies, retries, monitoring, backfills
@dag(schedule='@daily')
def etl_pipeline():
    extract_task = PythonOperator(task_id='extract', python_callable=extract)
    transform_task = PythonOperator(task_id='transform', python_callable=transform)
    load_task = PythonOperator(task_id='load', python_callable=load)
    
    extract_task >> transform_task >> load_task
```

**2025: dbt (Data Build Tool)**
```sql
-- Transformations as SQL with testing and documentation
{{ config(materialized='incremental', unique_key='id') }}

SELECT id, name, email, age
FROM {{ source('raw', 'users') }}
WHERE email IS NOT NULL
```

### Infrastructure

**2015: Single Server**
```
┌──────────────────────────────┐
│  Server: Cron + Node + File  │
└──────────────────────────────┘
```

**2025: Cloud-Native / Serverless**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  S3 Trigger  │────>│  AWS Lambda  │────>│  Snowflake   │
│  (new file)  │     │  (Transform) │     │  (Warehouse) │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Error Handling

**2015: Log and Pray**
```javascript
// Errors go to a log file no one reads
catch (e) { console.error(e); }
```

**2025: Dead Letter Queues + Alerting**
```typescript
// Bad rows go to DLQ for analysis
await sqs.sendMessage({
  QueueUrl: dlqUrl,
  MessageBody: JSON.stringify({ record, error }),
});

// PagerDuty fires if failure rate > 1%
if (failureRate > 0.01) await pagerduty.trigger('Pipeline failure spike');
```

### Schema Management

**2015: Hard-coded Assumptions**
```javascript
// Breaks when source adds a column
const id = row[0];
const name = row[1];
```

**2025: Schema Registry + Contract Testing**
```typescript
// Avro/Protobuf schemas versioned and enforced
const schema = await registry.getSchema('users-value', version);
const record = avro.decode(schema, buffer);

// Great Expectations / Soda Core for data quality
expect_table_row_count_to_be_between(9000, 11000);
expect_column_values_to_not_be_null('email');
```

### Data Quality

**2015: Eyeballing**
```sql
-- Analyst manually checks row count
SELECT COUNT(*) FROM users;
```

**2025: Automated Data Contracts**
```yaml
# dbt tests, Soda checks, Monte Carlo observability
tests:
  - unique: id
  - not_null: [email, name]
  - accepted_range:
      column: age
      min: 0
      max: 150
```

### Streaming

**2015: Batch Only**
```
Daily batch job at 2 AM
```

**2025: Streaming + Batch (Kappa/Lambda)**
```
Kafka -> Flink/Spark Streaming -> Real-time dashboard
    |
    -> S3 -> Spark Batch -> Daily reports
```

### Testing

**2015: No Tests**
```javascript
// "It worked on my machine"
```

**2025: Data Diff + Integration Tests**
```python
# dbt tests, data-diff between dev and prod
from data_diff import connect, diff_tables

diff = diff_tables(
    connect('snowflake', prod_conn),
    connect('snowflake', dev_conn),
    'users'
)
assert diff.row_count == 0
```
