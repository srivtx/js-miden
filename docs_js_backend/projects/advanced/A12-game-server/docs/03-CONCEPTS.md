# A12 Game Server: Core Concepts

## WHAT: Authoritative Game Server

An authoritative game server is the single source of truth for all game state. Clients send inputs; the server simulates the game world, validates all changes, and broadcasts the results.

```
┌─────────────────────────────────────────────────────────────┐
│                  AUTHORITATIVE GAME SERVER                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CLIENT A              SERVER              CLIENT B          │
│  ────────              ──────              ────────          │
│     │                    │                    │              │
│     │ "Move to (5,0)"   │                    │              │
│     │───────────────────▶│                    │              │
│     │                    │ Simulate tick      │              │
│     │                    │ - Check speed      │              │
│     │                    │ - Check collision  │              │
│     │                    │ - Update position  │              │
│     │                    │                    │              │
│     │                    │◀───────────────────│ "Shoot (5,0)"│
│     │                    │ Simulate hit       │              │
│     │                    │ - LOS check        │              │
│     │                    │ - Ammo check       │              │
│     │                    │ - Apply damage     │              │
│     │                    │                    │              │
│     │◀───────────────────│ "State: A@ (5,0), │              │
│     │                    │  health=80"        │              │
│     │                    │───────────────────▶│ "State: ..." │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## WHY: Why Server Authority?

### Why Not Trust the Client?
Because the client is controlled by the player. A malicious player can modify the client binary, intercept network packets, or use memory editors (Cheat Engine) to change health, ammo, or position. If the server trusts these values, the game is broken.

### Why Validate Every Input?
Because even benign clients can desync due to packet loss, clock skew, or hardware differences. Validation catches both cheating and bugs.

### Why Matchmaking Matters?
Because player retention is directly tied to match quality. According to Riot Games research:
- Players who win their first match are 40% more likely to play again
- Players who lose 5 matches in a row have a 90% churn rate
- A "stomp" (one-sided match) is rated as less fun than a close loss by both winners and losers

## HOW: State Validation & Matchmaking

### State Validation Algorithm
```typescript
function validateStateUpdate(
  session: GameSession,
  playerId: string,
  proposed: Partial<PlayerState>
): ValidationResult {
  const current = session.state.players[playerId];
  const invariants = getInvariants(session.gameMode);

  // Position validation
  if (proposed.position) {
    const distance = euclideanDistance(current.position, proposed.position);
    const maxDistance = invariants.maxSpeed * TICK_DURATION;
    if (distance > maxDistance) {
      return { valid: false, reason: 'Speed exceeded' };
    }
    if (!invariants.mapBounds.contains(proposed.position)) {
      return { valid: false, reason: 'Out of bounds' };
    }
  }

  // Health validation
  if (proposed.health !== undefined) {
    // Health can ONLY decrease from damage events, never increase from client
    if (proposed.health > current.health) {
      return { valid: false, reason: 'Health increase without heal event' };
    }
  }

  // Score validation
  if (proposed.score !== undefined) {
    // Score increases only from server-verified kills/objectives
    return { valid: false, reason: 'Score is server-authoritative' };
  }

  return { valid: true };
}
```

### TrueSkill Matchmaking (Simplified)
```typescript
function findMatch(player: Player, queue: Player[]): Match | null {
  // TrueSkill: skill is N(mu, sigma^2)
  // mu = estimated skill mean
  // sigma = uncertainty (high for new players)
  
  const candidates = queue.filter(p => 
    p.id !== player.id && 
    // Match quality based on overlap of skill distributions
    matchQuality(player.mu, player.sigma, p.mu, p.sigma) > 0.3
  );

  // Sort by match quality descending
  candidates.sort((a, b) => 
    matchQuality(player.mu, player.sigma, b.mu, b.sigma) -
    matchQuality(player.mu, player.sigma, a.mu, a.sigma)
  );

  if (candidates.length > 0) {
    return createMatch(player, candidates[0]);
  }
  return null;
}
```

## WRONG vs RIGHT

### WRONG: Client-State Merging Without Validation
```typescript
// BUG: Server accepts whatever the client claims
session.state.players[playerId] = {
  ...current,
  ...clientState, // Could be { health: 9999, position: { x: 1000000 } }
};
```

**Why it's wrong**: The client can claim anything. Health becomes infinite. Position teleports across the map. Score becomes arbitrary.

### RIGHT: Server-Side Simulation with Invariant Checking
```typescript
// CORRECT: Server simulates movement, rejects impossible states
const proposedMove = clientState.position;
const maxMove = PLAYER_SPEED * TICK_DURATION;

if (distance(current.position, proposedMove) > maxMove) {
  // Reject and flag player
  logCheatAttempt(playerId, 'speed_hack');
  return current.position; // Don't apply
}

// Health changes only from damage events registered by server
if (clientState.health !== undefined) {
  // Ignore client health; server calculates from damage log
}
```

### WRONG: Naive Skill Sorting
```typescript
// BUG: Matches lowest-skill players together
candidates.sort((a, b) => a.skillRating - b.skillRating);
const opponent = candidates[0]; // Always the lowest skill available
```

**Why it's wrong**: A smurf (skilled player with artificially low rating) will always be matched with genuine beginners. The smurf dominates, beginners quit.

### RIGHT: TrueSkill with Uncertainty
```typescript
// CORRECT: New accounts have high uncertainty, so they quickly
// match with similarly uncertain players or players near their TRUE skill
const opponent = candidates
  .map(p => ({
    player: p,
    quality: matchQuality(player.mu, player.sigma, p.mu, p.sigma),
    waitTime: now - p.queueStartTime,
  }))
  .sort((a, b) => {
    // Prioritize quality, but expand search after 30s
    const qualityWeight = Math.max(0.5, 1 - a.waitTime / 30000);
    return (b.quality * qualityWeight) - (a.quality * qualityWeight);
  })[0];
```
