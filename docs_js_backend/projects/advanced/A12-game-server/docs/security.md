# Security

## Authentication

JWT tokens with short expiry. Refresh token rotation.

## State Validation

**Current Issue:** Client can send arbitrary state.

**Required Implementation:**
```typescript
function validateStateUpdate(current: PlayerState, update: Partial<PlayerState>): boolean {
  if (update.health !== undefined && (update.health < 0 || update.health > current.maxHealth)) {
    return false;
  }
  if (update.ammo !== undefined && (update.ammo < 0 || update.ammo > 30)) {
    return false;
  }
  // Position sanity: max distance per tick
  return true;
}
```

## Matchmaking Security

**Current Issue:** Smurf accounts exploit low-skill queues.

**Mitigations:**
- Track account age and games played
- Use rating uncertainty (new accounts have high variance)
- Behavioral similarity analysis
- Phone verification for ranked play

## Rate Limiting

- Max 60 state updates/second per player
- Max 10 queue attempts/minute
