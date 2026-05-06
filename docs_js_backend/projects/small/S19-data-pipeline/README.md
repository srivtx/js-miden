# S19: Data Pipeline (ETL)

Extract, Transform, Load pipeline for CSV to database ingestion.

## Features

- POST `/pipeline` - Trigger ETL pipeline
- GET `/pipeline/:id` - Check pipeline status
- Track records processed and failed

## Bugs

1. **Not Idempotent**: Re-running pipeline creates duplicate records
2. **No Error Isolation**: One bad row fails the entire batch

## Quick Start

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```
