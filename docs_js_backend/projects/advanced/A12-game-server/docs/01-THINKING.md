# A12 Game Server: Design Thinking

## Constraints & Forces

### 1. Latency vs Consistency
A perfectly consistent server waits for all clients before advancing the game tick. This creates input lag. A low-latency server processes inputs immediately but risks desync.

**Resolution**: Server-authoritative with client-side prediction. The client predicts its own movement locally, but the server corrects if the prediction is wrong.

### 2. Throughput vs Cost
A 128-tick server for a 5v5 shooter processes 1,280 state updates per second (10 players × 128 ticks). At $0.024/hour per instance, 10,000 concurrent matches cost $240/hour. Reducing to 64-tick halves cost but doubles perceived latency.

**Resolution**: Variable tick rate. LAN tournaments get 128-tick. Casual matchmaking gets 64-tick.

### 3. Skill Rating Accuracy vs Queue Time
An exact-skill match might take 10 minutes to find. A loose match takes 10 seconds but is unfun for the lower-skill player.

**Resolution**: Dynamic skill expansion. Start with tight bounds, expand by 10% every 30 seconds. Cap at ±500 skill points.

## Mental Models

### The Game State as a CRDT (Conflict-Free Replicated Data Type)
Each player's state is a register. The server merges all registers each tick. Cheating attempts are rejected at merge time.

```
Tick 0:
  Player A: { pos: (0,0), health: 100 }
  Player B: { pos: (10,0), health: 100 }

Tick 1:
  Player A input: "move to (1,0)"
  Player B input: "shoot at (1,0)"
  
  Server simulation:
    A moves to (1,0) [valid, speed < max]
    B fires bullet [valid, ammo > 0]
    Bullet hits A at (1,0) [valid, line of sight]
    
  Tick 1 State:
    A: { pos: (1,0), health: 80 }
    B: { pos: (10,0), health: 100, ammo: 29 }
```

### Matchmaking as a Graph Problem
Players are nodes. An edge exists if |skillA - skillB| < threshold. A match is a clique of appropriate size. Finding a clique quickly is NP-hard, so we use greedy heuristics.

### Anti-Cheat as an Invariant Checker
The server maintains invariants:
- `speed <= max_speed`
- `health <= max_health`
- `ammo <= max_ammo`
- `position inside map_bounds`

Any state update violating an invariant is rejected, and the player is flagged.

## Risk Scenarios

1. **State injection**: A client sends `{ health: 9999 }`. The server accepts it. The player becomes invincible.
2. **Speed hacking**: A client claims to have moved 100 units in 1 tick. The server accepts it. The player teleports.
3. **Smurfing**: A skilled player creates a new account with low skill rating. The matchmaker pairs them with beginners. The skilled player dominates, ruining the experience for 9 other players.
4. **Desync**: Client A sees Player B at (5,0), but the server says Player B is at (10,0). A shoots at (5,0) and misses. The player blames "netcode."

## Trade-Off Analysis

| Approach | Pros | Cons |
|----------|------|------|
| Pure server simulation | Perfect anti-cheat | High latency, server cost |
| Client-authoritative | Zero latency | Rampant cheating |
| Hybrid (client pred + server reconcile) | Best of both | Complex, occasional rubber-banding |
| Deterministic lockstep (RTS) | Minimal bandwidth | All players wait for slowest connection |
| Snapshot interpolation (FPS) | Smooth visuals | Delayed hit registration |
