# 05-BUILD.md

## Step-by-Step Build Instructions

### Prerequisites

- Node.js 20+
- npm 10+

### Step 1: Initialize Project

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/small/S19-data-pipeline
npm install
```

Dependencies installed:
- `express` — HTTP server
- `csv-parse` — CSV parsing
- `uuid` — Pipeline ID generation
- `typescript`, `tsx` — TypeScript compilation

### Step 2: Understand the File Structure

```
S19-data-pipeline/
├── src/
│   ├── pipeline.ts  # ETL logic (BUGGY)
│   ├── routes.ts    # HTTP routes
│   └── index.ts     # Express app setup
├── tests/
│   └── pipeline.test.ts
└── docs/
    └── ...
```

### Step 3: Review the Pipeline

```typescript
// src/pipeline.ts

interface PipelineStatus {
  id: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  startedAt: string;
  completedAt?: string;
}

interface Record {
  id: string;
  name: string;
  email: string;
  age: number;
}

const pipelines: Map<string, PipelineStatus> = new Map();
const processedRecords: Map<string, Record[]> = new Map();
```

### Step 4: Run the Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Step 5: Test the API

```bash
# Trigger pipeline
curl -X POST http://localhost:3000/pipeline \
  -H "Content-Type: application/json" \
  -d '{"source": "users.csv", "destination": "users"}'

# Check status
curl http://localhost:3000/pipeline/{pipelineId}
```

### Step 6: Run Tests (Two Should Fail)

```bash
npm test
```

Expected output:
```
✓ pipeline creates status entry
✗ pipeline is idempotent on re-run (duplicate records bug)
✗ pipeline isolates errors and loads valid rows (no error isolation bug)
```

### Step 7: Fix Bug 1 — Not Idempotent

**File**: `src/pipeline.ts`

**WRONG** (current):
```typescript
async function load(destination: string, records: Record[], pipelineId: string): Promise<void> {
  // Validates ALL records first (throws on first bad row)
  for (const record of records) {
    validateRecord(record);  // Throws!
  }
  
  // BUG: Just appends records, creating duplicates on re-run
  const existing = processedRecords.get(destination) || [];
  processedRecords.set(destination, [...existing, ...records]);
  
  const status = pipelines.get(pipelineId);
  if (status) {
    status.recordsProcessed += records.length;
  }
}
```

**RIGHT** (fix — idempotent with UPSERT logic):
```typescript
async function load(destination: string, records: Record[], pipelineId: string): Promise<void> {
  const status = pipelines.get(pipelineId)!;
  
  for (const record of records) {
    try {
      validateRecord(record);
      
      // UPSERT: Update existing or insert new
      const existing = processedRecords.get(destination) || [];
      const index = existing.findIndex(r => r.id === record.id);
      
      if (index >= 0) {
        existing[index] = record;  // Update existing
      } else {
        existing.push(record);      // Insert new
      }
      
      processedRecords.set(destination, existing);
      status.recordsProcessed++;
    } catch (error) {
      status.recordsFailed++;
      status.errors.push(`Record ${record.id}: ${(error as Error).message}`);
    }
  }
}
```

### Step 8: Fix Bug 2 — No Error Isolation

**File**: `src/pipeline.ts`

**WRONG** (current):
```typescript
async function load(destination, records, pipelineId) {
  // Validates ALL records before saving ANY
  for (const record of records) {
    validateRecord(record);  // One bad row kills the whole batch
  }
  // ... save all
}
```

**RIGHT** (already partially fixed in Step 7, but here's the full runPipeline fix):
```typescript
export async function runPipeline(source: string, destination: string): Promise<string> {
  const pipelineId = uuid();
  const status: PipelineStatus = {
    id: pipelineId,
    status: 'running',
    recordsProcessed: 0,
    recordsFailed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };
  pipelines.set(pipelineId, status);
  
  try {
    // Extract
    const csvData = await extract(source);
    
    // Transform
    const transformed = transform(csvData);
    
    // Load with error isolation
    await load(destination, transformed, pipelineId);
    
    status.status = 'completed';
    status.completedAt = new Date().toISOString();
  } catch (error) {
    // Only catch catastrophic errors (extract/transform failures)
    status.status = 'failed';
    status.errors.push(error instanceof Error ? error.message : String(error));
    status.completedAt = new Date().toISOString();
  }
  
  return pipelineId;
}
```

**Updated Validation**:
```typescript
function validateRecord(record: Record): void {
  if (!record.email || !record.email.includes('@')) {
    throw new Error(`Invalid email: ${record.email}`);
  }
  if (isNaN(record.age) || record.age < 0 || record.age > 150) {
    throw new Error(`Invalid age: ${record.age}`);
  }
}
```

### Step 9: Verify Fixes

```bash
npm test
# All tests should pass now
```

### Step 10: Experiment

```bash
# Run pipeline first time
curl -X POST http://localhost:3000/pipeline \
  -d '{"source":"users.csv","destination":"users"}'

# Check records
curl http://localhost:3000/pipeline/records/users
# Should show 3 valid records (Alice, Bob, Dave)
# Charlie excluded due to invalid email

# Re-run pipeline (should be idempotent)
curl -X POST http://localhost:3000/pipeline \
  -d '{"source":"users.csv","destination":"users"}'

# Check records again
curl http://localhost:3000/pipeline/records/users
# Should still show exactly 3 records, no duplicates!
```
