# 05-BUILD.md

## Step-by-Step Build Instructions

### Prerequisites

- Node.js 20+
- npm 10+

### Step 1: Initialize Project

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/small/S17-event-sourcing
npm install
```

Dependencies installed:
- `express` — HTTP server
- `uuid` — Event ID generation
- `typescript`, `tsx` — TypeScript compilation

### Step 2: Understand the File Structure

```
S17-event-sourcing/
├── src/
│   ├── store.ts    # Event store, state management (BUGGY)
│   ├── routes.ts   # HTTP routes
│   └── index.ts    # Express app setup
├── tests/
│   └── store.test.ts
└── docs/
    └── ...
```

### Step 3: Review the Event Store

```typescript
// src/store.ts

interface Event {
  id: string;
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  version: number;
}

interface AccountState {
  id: string;
  owner: string;
  balance: number;
  version: number;
}

// Event log (append-only)
const eventStore: Event[] = [];

// BUG: Direct state cache bypassing event replay
const accountState: Map<string, AccountState> = new Map();
```

### Step 4: Run the Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Step 5: Test the API

```bash
# Create an account
curl -X POST http://localhost:3000/events/accounts \
  -H "Content-Type: application/json" \
  -d '{"owner": "Alice"}'
# Returns: { id: "uuid", owner: "Alice", balance: 0, version: 1 }

# Deposit money
curl -X POST http://localhost:3000/events/accounts/{id}/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}'

# Check balance
curl http://localhost:3000/events/accounts/{id}/balance

# View events
curl http://localhost:3000/events/accounts/{id}/events
```

### Step 6: Run Tests (Two Should Fail)

```bash
npm test
```

Expected output:
```
✓ createAccount appends AccountCreated event
✓ getEvents returns events for aggregate
✗ deposit should rebuild state from events (direct mutation bug)
✗ getBalance should replay events, not read cache (no snapshotting bug)
```

### Step 7: Fix Bug 1 — Direct State Update

**File**: `src/store.ts`

**WRONG** (current):
```typescript
export function deposit(accountId: string, amount: number): AccountState | null {
  const state = accountState.get(accountId); // Reads from mutable cache
  if (!state) return null;
  
  const event: Event = { type: 'MoneyDeposited', aggregateId: accountId, payload: { amount }, ... };
  eventStore.push(event);
  
  state.balance += amount;  // MUTATES CACHE DIRECTLY!
  state.version += 1;
  return state;
}
```

**RIGHT** (fix):
```typescript
export function deposit(accountId: string, amount: number): AccountState | null {
  // 1. REBUILD state from events (sole source of truth)
  const state = rebuildState(accountId);
  if (!state) return null;
  
  // 2. Validate business rules
  // (In a real system, check overdraft limits here)
  
  // 3. Create event
  const event: Event = {
    id: uuid(),
    type: 'MoneyDeposited',
    aggregateId: accountId,
    payload: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };
  
  // 4. Append event
  eventStore.push(event);
  
  // 5. Return FRESH rebuild (do NOT mutate cache)
  return rebuildState(accountId);
}
```

Apply the same fix to `withdraw()`:
```typescript
export function withdraw(accountId: string, amount: number): AccountState | { error: string } | null {
  const state = rebuildState(accountId);
  if (!state) return null;
  if (state.balance < amount) return { error: 'Insufficient funds' };
  
  const event: Event = {
    id: uuid(),
    type: 'MoneyWithdrawn',
    aggregateId: accountId,
    payload: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };
  
  eventStore.push(event);
  return rebuildState(accountId);
}
```

Also fix `createAccount`:
```typescript
export function createAccount(owner: string): AccountState {
  const id = uuid();
  const event: Event = {
    id: uuid(),
    type: 'AccountCreated',
    aggregateId: id,
    payload: { owner },
    timestamp: new Date().toISOString(),
    version: 1,
  };
  eventStore.push(event);
  
  // Return rebuilt state, not direct cache
  return rebuildState(id)!;
}
```

### Step 8: Fix Bug 2 — No Snapshotting

**File**: `src/store.ts`

**WRONG** (current):
```typescript
export function getBalance(accountId: string): AccountState | null {
  return accountState.get(accountId) || null; // Returns stale cache
}
```

**RIGHT** (fix — rebuild from events):
```typescript
export function getBalance(accountId: string): AccountState | null {
  return rebuildState(accountId);
}
```

**BONUS — Add Snapshotting**:
```typescript
const snapshots: Map<string, Snapshot> = new Map();

interface Snapshot {
  aggregateId: string;
  state: AccountState;
  version: number;
  timestamp: string;
}

export function getBalance(accountId: string): AccountState | null {
  const snapshot = snapshots.get(accountId);
  const events = snapshot 
    ? getEvents(accountId).filter(e => e.version > snapshot.version)
    : getEvents(accountId);
  
  let state = snapshot?.state || { id: accountId, owner: '', balance: 0, version: 0 };
  
  // Apply events since snapshot
  for (const event of events) {
    state = applyEvent(state, event);
  }
  
  // Save snapshot if drift is large
  if (events.length > 100) {
    snapshots.set(accountId, {
      aggregateId: accountId,
      state: { ...state },
      version: state.version,
      timestamp: new Date().toISOString(),
    });
  }
  
  return state;
}

function applyEvent(state: AccountState, event: Event): AccountState {
  const next = { ...state };
  switch (event.type) {
    case 'AccountCreated':
      next.owner = event.payload.owner as string;
      next.version = event.version;
      break;
    case 'MoneyDeposited':
      next.balance += event.payload.amount as number;
      next.version = event.version;
      break;
    case 'MoneyWithdrawn':
      next.balance -= event.payload.amount as number;
      next.version = event.version;
      break;
  }
  return next;
}
```

### Step 9: Verify Fixes

```bash
npm test
# All tests should pass now
```

### Step 10: Experiment

```bash
# Create account
curl -X POST http://localhost:3000/events/accounts -d '{"owner":"Test"}'

# Make 5 deposits
for i in {1..5}; do
  curl -X POST http://localhost:3000/events/accounts/{id}/deposit -d "{\"amount\":$i}"
done

# Check events
curl http://localhost:3000/events/accounts/{id}/events
# Should show 6 events (1 created + 5 deposits)

# Check balance
curl http://localhost:3000/events/accounts/{id}/balance
# Should show balance = 15 (1+2+3+4+5)
```
