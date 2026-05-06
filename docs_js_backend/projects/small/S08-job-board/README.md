# S08: Job Board API

## Overview
A REST API for managing job postings with filtering, sorting, and pagination capabilities.

## Thinking Framework

### PHASE 1: Core CRUD
- Build endpoints for creating, reading, updating, and deleting jobs.
- Fields: title, company, location, salary_min, salary_max, type, remote, posted_date.
- Implement query-based filtering and sorting.

### PHASE 2: Design Decisions
- **Filtering Strategy**: For small datasets, SQL `WHERE` clauses are sufficient. For large-scale search with full-text and fuzzy matching, Elasticsearch or a dedicated search index is more appropriate.
- **Range Queries**: Salary range filtering requires a composite condition (`salary_max >= min AND salary_min <= max`). Without proper indexing on both columns, these queries perform full table scans.
- **Pagination**: Cursor-based pagination is preferred for stability with sorted results; offset pagination is simpler but suffers from drift when new records are inserted.
- **Money Data Types**: Storing monetary values as floating-point numbers introduces binary representation errors. Best practice is to store money as integer cents.

### PHASE 3: Bugs & Hardening
This project intentionally contains bugs to test awareness:

1. **Salary stored as float (`REAL`)**: Values like `99.99` cannot be represented exactly in IEEE 754 binary. This leads to rounding errors in comparisons and display.
2. **SQL Injection**: The filter endpoint concatenates user input directly into SQL strings instead of using parameterized queries.
3. **Missing Indexes**: No indexes exist on `type`, `remote`, `location`, or `salary_*`, causing slow queries as the dataset grows.

## Project Structure
```
src/
  db.ts       - SQLite in-memory database setup (schema with REAL salary)
  jobs.ts     - Route handlers with vulnerable filter logic
  app.ts      - Express application composition
  index.ts    - Server entry point
tests/
  jobs.test.ts - Vitest tests including SQL injection and float bug demos
```

## Running
```bash
npm install
npm run dev     # tsx src/index.ts
npm test        # vitest run
```

## Example Requests
```bash
# Create job
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"title":"Dev","company":"X","location":"NYC","salary_min":100000,"salary_max":150000,"type":"full-time","remote":true}'

# Filter jobs
curl "http://localhost:3000/jobs?type=full-time&remote=true&sort_by=salary_min&order=asc"
```
