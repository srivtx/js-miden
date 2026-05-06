# S19 Data Pipeline — v1 Simple JS

## The Naive Implementation

You need to move data from a CSV into your database. Simple:

```js
// app.js
const fs = require('fs');

function runPipeline(sourceFile, destinationDb) {
  const csv = fs.readFileSync(sourceFile, 'utf8');
  const rows = csv.split('\n').slice(1);

  for (const row of rows) {
    const [id, name, email, age] = row.split(',');
    destinationDb.insert({ id, name, email, age });
  }

  console.log('Pipeline complete');
}

runPipeline('users.csv', db);
```

Works locally:
```bash
node app.js
# → Pipeline complete
```

## The Pain in Production

### 1. Manual Execution

The script only runs when someone manually executes it. A new CSV arrives at 2 AM. No one is awake. The data is stale for 6 hours until someone runs it.

### 2. No Error Handling

```js
const [id, name, email, age] = row.split(',');
destinationDb.insert({ id, name, email, age });
```

One malformed row (missing column, bad encoding, quoted comma) and the entire script crashes. Half the CSV is loaded, half is not. You have a partially consistent database.

### 3. No Idempotency

You run the pipeline twice because the first run crashed halfway. Now every record exists twice. Three runs? Triplets. Your analytics are wrong, your billing is wrong, your users get duplicate emails.

### 4. No Validation

```csv
1,Alice,alice@example.com,30
2,Bob,bob@example.com,25
3,Charlie,charlie@example,invalid
```

`charlie@example` has no `@domain`. `invalid` is not a number. These bad rows are inserted into your database, corrupting downstream reports.

### 5. Silent Failures

When the script fails, you only know if you happen to check the terminal output. There's no alerting, no log aggregation, no visibility into whether pipelines are succeeding or failing.

## The Lesson

A manual script is fine for one-off tasks. For production data, you need automation, error isolation, idempotency, validation, and observability.

## What v2 Fixes

TypeScript. Before we fix the pipeline architecture, let's get the types right.
