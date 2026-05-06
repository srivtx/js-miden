# Database Schema

## jobs

| Column        | Type       | Description                          |
|---------------|------------|--------------------------------------|
| id            | TEXT PK    | UUID job identifier                  |
| type          | TEXT       | Job type (e.g., video.transcode)     |
| payload       | JSONB      | Job input data                       |
| status        | TEXT       | pending/processing/completed/failed/dead |
| progress      | INTEGER    | Percentage complete (0-100)          |
| result        | JSONB      | Output data on success               |
| error         | TEXT       | Error message on failure             |
| attempt_count | INTEGER    | Number of processing attempts        |
| created_at    | TIMESTAMP  | Creation time                        |
| updated_at    | TIMESTAMP  | Last update time                     |

## Indexes

```sql
CREATE INDEX idx_jobs_status ON jobs(status);
```

This index speeds up queries that poll for jobs by status (e.g., dashboard queries showing pending jobs).

## State Machine

```
pending ──▶ processing ──▶ completed
    │            │
    └────────────┴──▶ failed ──▶ dead (after 3 attempts)
```
