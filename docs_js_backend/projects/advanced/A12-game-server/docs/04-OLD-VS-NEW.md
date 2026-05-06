# A12 Game Server: Old vs New (2015 vs 2025)

## 2015 Approach: Client-Authoritative, P2P, Vulnerable

### Architecture
```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Player A│◄───────►│ Player B│◄───────►│ Player C│
│ (Host)  │   P2P   │         │   P2P   │         │
└─────────┘         └─────────┘         └─────────┘
```

### Characteristics
- **Peer-to-peer networking**: One player is the "host"
- **Client-authoritative**: Host's client decides hits, deaths, scores
- **No server validation**: Clients trust each other
- **Manual matchmaking**: Server browser, friends list, or random lobby
- **Tick rate**: 20-30Hz (console standard)

### Code (2015 Style)
```javascript
// 2015: Client sends full state, host accepts
socket.on('stateUpdate', (data) => {
  players[data.playerId] = data.state; // No validation!
  broadcast(data);
});
```

### Problems
1. Host can lag-switch, drop packets, or modify state
2. Any player can use Cheat Engine to change health/ammo
3. No persistent records; host disconnect = game over
4. NAT traversal issues; many players can't connect

---

## 2025 Approach: Server-Authoritative, Cloud-Native, Validated

### Architecture
```
┌─────────┐      ┌──────────────┐      ┌─────────┐
│ Player A│◄────►│  Game Server │◄────►│ Player B│
│ (Client)│      │  (Kubernetes)│      │ (Client)│
└─────────┘      └──────┬───────┘      └─────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  Redis       │
                 │  (State Cache)│
                 └──────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  PostgreSQL  │
                 │  (Persistence)│
                 └──────────────┘
```

### Characteristics
- **Dedicated servers**: No player is host. Servers run in cloud data centers.
- **Server-authoritative**: Server simulates physics, validates hits
- **Client-side prediction**: Client predicts movement locally; server corrects discrepancies
- **Matchmaking service**: Elo/TrueSkill with machine learning enhancements
- **Anti-cheat**: Kernel-level drivers (Easy Anti-Cheat, BattlEye) + server-side heuristics
- **Tick rate**: 60-128Hz for competitive shooters

### Code (2025 Style)
```typescript
// 2025: Server validates every input
gameServer.on('input', (playerId, input) => {
  const player = state.getPlayer(playerId);
  
  // Validate against server simulation
  const predictedPos = physics.simulate(player.position, input);
  const clientClaimedPos = input.position;
  
  if (distance(predictedPos, clientClaimedPos) > TOLERANCE) {
    // Desync detected: force server state to client
    player.send('correction', { position: predictedPos });
  } else {
    player.position = predictedPos;
  }
  
  // Broadcast to other players with interpolation delay
  broadcastSnapshot(state.snapshot(), EXCEPT(playerId));
});
```

### Evolution Summary

| Aspect | 2015 | 2025 |
|--------|------|------|
| Authority | Client / P2P host | Dedicated server |
| Networking | UDP P2P | QUIC / WebSockets via relay |
| Anti-cheat | None / client-side | Kernel drivers + ML heuristics |
| Matchmaking | Server browser | Skill-based + behavioral ML |
| Tick rate | 20-30Hz | 60-128Hz |
| Netcode | Delay-based | Client prediction + rollback |
| Persistence | Local save files | Cloud profiles + battle passes |
| Monetization | $60 box price | F2P + cosmetics + season passes |

## What Changed Dramatically

- **Rollback netcode**: Fighting games (Street Fighter, Tekken) now use rollback: predict opponent inputs, roll back and correct on misprediction. This makes 200ms ping feel like offline play.
- **Cloud gaming**: Google Stadia (RIP), Xbox Cloud, GeForce NOW stream video instead of game state. The server IS the client.
- **AI anti-cheat**: Riot's Vanguard and Valve's VACnet use machine learning to detect aimbots by analyzing mouse movement patterns.
- **Cross-play**: PS5, Xbox, PC players in the same match. Requires input normalization (aim assist for controllers vs mouse).

## What Didn't Change

- **The need for fairness**: Players will quit if they perceive cheating
- **Latency is king**: No amount of netcode magic fixes physics
- **Social features matter**: Friends lists, clans, and voice chat drive retention more than graphics
