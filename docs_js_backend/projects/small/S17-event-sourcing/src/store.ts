import { v4 as uuid } from 'uuid';

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

const eventStore: Event[] = [];
// BUG: Direct state update bypassing events
// This defeats the purpose of event sourcing
const accountState: Map<string, AccountState> = new Map();

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
  // Direct state update - BUG!
  const state: AccountState = { id, owner, balance: 0, version: 1 };
  accountState.set(id, state);
  return state;
}

export function deposit(accountId: string, amount: number): AccountState | null {
  // BUG: Direct state update bypassing events
  const state = accountState.get(accountId);
  if (!state) return null;
  
  const event: Event = {
    id: uuid(),
    type: 'MoneyDeposited',
    aggregateId: accountId,
    payload: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };
  eventStore.push(event);
  // Direct mutation - BUG!
  state.balance += amount;
  state.version += 1;
  return state;
}

export function withdraw(accountId: string, amount: number): AccountState | { error: string } | null {
  // BUG: Direct state update bypassing events
  const state = accountState.get(accountId);
  if (!state) return null;
  
  if (state.balance < amount) {
    return { error: 'Insufficient funds' };
  }
  
  const event: Event = {
    id: uuid(),
    type: 'MoneyWithdrawn',
    aggregateId: accountId,
    payload: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };
  eventStore.push(event);
  // Direct mutation - BUG!
  state.balance -= amount;
  state.version += 1;
  return state;
}

export function getBalance(accountId: string): AccountState | null {
  // BUG: No snapshotting - should replay events to rebuild state
  // but since we store direct state, this returns stale data if events are modified
  return accountState.get(accountId) || null;
}

export function getEvents(accountId: string): Event[] {
  return eventStore.filter(e => e.aggregateId === accountId);
}

// Correct approach: rebuild state from events
export function rebuildState(accountId: string): AccountState | null {
  const events = getEvents(accountId);
  if (events.length === 0) return null;
  
  let state: AccountState = { id: accountId, owner: '', balance: 0, version: 0 };
  for (const event of events) {
    switch (event.type) {
      case 'AccountCreated':
        state.owner = event.payload.owner as string;
        state.version = event.version;
        break;
      case 'MoneyDeposited':
        state.balance += event.payload.amount as number;
        state.version = event.version;
        break;
      case 'MoneyWithdrawn':
        state.balance -= event.payload.amount as number;
        state.version = event.version;
        break;
    }
  }
  return state;
}
