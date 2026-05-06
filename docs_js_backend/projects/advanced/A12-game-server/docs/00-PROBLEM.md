# A12 Game Server: The Problem

## What Problem Are We Solving?

Multiplayer online games require a backend that can:
1. Match players of similar skill into competitive sessions
2. Maintain a shared, authoritative game state across multiple clients
3. Detect and prevent cheating (speed hacks, aimbots, state manipulation)
4. Persist results to leaderboards and player profiles

Without a dedicated game server, players connect peer-to-peer. This creates:
- **Host advantage**: The player acting as server has zero latency and can manipulate state
- **Easy cheating**: Clients trust each other; a modified client wins every time
- **No persistence**: Wins and losses evaporate when the host disconnects
- **Poor matchmaking**: Players manually find lobbies, leading to skill imbalance

## Core Requirements

| Requirement | Why It Matters |
|-------------|---------------|
| **Authoritative server** | The server, not the client, decides who took damage, who scored, who won. |
| **Deterministic simulation** | Given the same inputs, the game state must evolve identically on server and client. |
| **Low-latency state sync** | 100ms of delay makes a shooter unplayable. 20ms is competitive. |
| **Fair matchmaking** | Matching beginners against pros destroys retention. 90% of players who lose 5 matches in a row quit forever. |
| **Anti-cheat validation** | Server must reject impossible state updates (teleporting, infinite health). |

## The Specific Domain: Competitive Multiplayer

This server handles:
- **Player registration**: Create accounts with skill ratings
- **Matchmaking**: Queue players and pair them into sessions
- **Game state updates**: Clients send inputs, server validates and broadcasts
- **Game completion**: Determine winner, update ratings, record stats

## Real-World Context

- **League of Legends**: 150M+ registered players, 8M concurrent at peak. Matchmaking uses a modified Elo system with role-based matching.
- **Valorant**: Uses Riot's custom netcode with 128-tick servers, sub-35ms latency requirement.
- **Fortnite**: 100 players per match, server-authoritative physics, client-side prediction for building.
- **Counter-Strike**: 64-tick (MM) or 128-tick (FaceIt) servers. One frame of desync can decide a round.

## Why a Custom Server?

Off-the-shelf solutions (Photon, GameLift, PlayFab) exist, but understanding the internals is essential because:
- Custom anti-cheat is a competitive advantage
- Matchmaking algorithms are tuned per game (1v1 vs 5v5 vs Battle Royale)
- Netcode is game-genre specific (RTS lockstep vs FPS client prediction)
- Cost: AWS GameLift costs $0.024/hour per instance. For 100,000 concurrent players, that's $2,400/hour. Optimizing server density saves millions.

## The Trust Model

```
CLIENT            SERVER             CLIENT
  │                  │                  │
  │ "I moved to X"   │                  │
  │─────────────────▶│                  │
  │                  │ Validate:        │
  │                  │ - Speed < max?   │
  │                  │ - Wall collision?│
  │                  │                  │
  │                  │◀─────────────────│ "I shot at Y"
  │                  │ Validate:        │
  │                  │ - Ammo > 0?      │
  │                  │ - Line of sight? │
  │                  │                  │
  │ "State update"   │                  │
  │◀─────────────────│─────────────────▶│ "State update"
```

The server is the judge. Clients are untrusted witnesses.
