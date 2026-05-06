import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createAccount, deposit, getEvents, rebuildState, getBalance } from '../src/store.js';

describe('Event Sourcing', () => {
  it('should create account and store event', () => {
    const account = createAccount('Alice');
    const events = getEvents(account.id);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'AccountCreated');
  });

  it('should deposit and create event', () => {
    const account = createAccount('Bob');
    deposit(account.id, 100);
    const events = getEvents(account.id);
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[1].type, 'MoneyDeposited');
  });

  // FAILING TEST: Direct state update bypasses events
  it('should rebuild state from events, not direct state', () => {
    const account = createAccount('Charlie');
    deposit(account.id, 100);
    deposit(account.id, 50);
    
    // Manually inject an event (simulating audit correction)
    const events = getEvents(account.id);
    events.push({
      id: 'manual-event',
      type: 'MoneyDeposited',
      aggregateId: account.id,
      payload: { amount: 200 },
      timestamp: new Date().toISOString(),
      version: events.length + 1,
    });
    
    // Rebuild from events should include the manual event
    const rebuilt = rebuildState(account.id);
    const direct = getBalance(account.id);
    
    // This test fails because direct state (150) doesn't match rebuilt state (350)
    assert.strictEqual(rebuilt?.balance, direct?.balance, 'State should be rebuilt from events');
  });

  // FAILING TEST: No snapshotting
  it('should use snapshots for performance', () => {
    const account = createAccount('Dave');
    // Create many events
    for (let i = 0; i < 100; i++) {
      deposit(account.id, 1);
    }
    
    const start = Date.now();
    const state = rebuildState(account.id);
    const duration = Date.now() - start;
    
    // Without snapshots, replaying many events is slow
    // This test demonstrates the need for snapshotting
    assert.strictEqual(state?.balance, 100, 'Balance should be 100');
    assert.ok(duration < 10, `Replaying 100 events took ${duration}ms, need snapshots`);
  });
});
