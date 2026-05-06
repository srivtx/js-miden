# A12 Game Server: Architecture Decisions

## Decision 1: Server-Authoritative State Updates

**Chosen**: Clients send inputs/desired state. Server validates and broadcasts authoritative state.

**Alternatives Considered**:
- **Client-authoritative**: Clients simulate locally and send state to server. Server forwards without validation. Pro: zero latency. Con: trivial to cheat.
- **Deterministic lockstep**: All clients simulate identically. Only inputs are sent. Pro: minimal bandwidth. Con: all players wait for the slowest; unusable for action games.
- **Snapshot interpolation**: Server sends full state snapshots 20-60x/second. Clients interpolate between snapshots. Pro: smooth, simple. Con: bandwidth-heavy, delayed feedback.

**Rationale**: Server-authoritative is the only approach that prevents cheating. Latency is managed through client-side prediction and server reconciliation.

## Decision 2: Elo-Based Matchmaking with Fixed Gap

**Chosen**: Simple Elo rating with a maximum skill gap of 200 points.

**Alternatives Considered**:
- **TrueSkill (Microsoft)**: Models skill as a Gaussian distribution (mean + uncertainty). Pro: handles teams, detects smurfs via high uncertainty. Con: complex, patented until 2018.
- **Glicko-2**: Similar to TrueSkill but open. Adds rating volatility. Pro: better for inactive players. Con: harder to explain to players.
- **Machine Learning (Riot Games)**: Neural networks predict match outcome based on 100+ features. Pro: highly accurate. Con: requires massive data, black box.
- **Hand-crafted rules**: Match by rank tier (Bronze, Silver, Gold). Pro: simple, intuitive. Con: rigid, doesn't account for skill variance within tiers.

**Rationale**: For a teaching project, Elo is sufficient. In production, TrueSkill or Glicko-2 is standard for competitive games.

## Decision 3: In-Memory Sessions

**Chosen**: Store active game sessions in a JavaScript Map.

**Alternatives Considered**:
- **Redis**: Shared state across multiple server instances. Pro: horizontal scaling. Con: 1-5ms latency per operation.
- **CockroachDB**: Distributed SQL with serializable transactions. Pro: ACID across regions. Con: 10-50ms latency.
- **Custom UDP protocol**: Games traditionally use UDP for state sync. Pro: lower latency than TCP. Con: packet loss, ordering issues.

**Rationale**: HTTP REST is not a real-time game protocol. This project uses HTTP for simplicity, but a production game server would use WebSockets (TCP) or QUIC (UDP) for state sync.

## Decision 4: No State Validation in Game Updates

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: Server simulates movement, checks bounds, verifies health changes come from legitimate damage events.

**Why the original skipped it**: To "keep the demo simple." This makes the demo a cheating tutorial.

## Decision 5: Naive Matchmaking (Lowest Skill First)

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: TrueSkill with uncertainty decay, smurf detection heuristics (new account + high win rate = flag), and spread-based matching.

**Why the original skipped it**: Elo sorting is easy to implement. Smurf detection requires player history and statistical modeling.
