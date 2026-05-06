# v1 — Simple JS (Naive Game Server)

## The Scenario

It's 2am. Your junior just deployed their first game server. "Players can move and shoot!" they say. You ask what happens when a client says they moved 1000 units in one tick. They shrug.

## The PAIN: Client-Authoritative State

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const players = {}; // <-- Client tells us where they are. We believe them.
const sessions = {}; // <-- Games live here. Until restart.

app.post('/move', (req, res) => {
  const { playerId, x, y, z } = req.body;
  if (!players[playerId]) {
    players[playerId] = { health: 100, score: 0, position: { x: 0, y: 0, z: 0 } };
  }
  // The client decides where they are. What could go wrong?
  players[playerId].position = { x, y, z };
  res.json(players[playerId]);
});

app.post('/shoot', (req, res) => {
  const { playerId, targetId, damage } = req.body;
  if (players[targetId]) {
    players[targetId].health -= damage; // Client decides damage too!
    if (players[targetId].health <= 0) {
      players[playerId].score += 1;
    }
  }
  res.json({ success: true });
});

app.listen(3000);
```

### What breaks in production:

1. **Teleportation hacks**: Client sends `{ x: 9999, y: 9999, z: 9999 }`. Server accepts it. Player is now across the map in one tick.

2. **Infinite damage**: Client sends `damage: 99999`. One-shot kills everyone. The server never validates.

3. **Score manipulation**: Client sends their own `/shoot` with `playerId` and `targetId` swapped. They get points for being shot.

4. **No matchmaking**: Players manually find each other. Beginners fight pros. 90% of players who lose 5 matches in a row quit forever.

5. **Data loss on restart**: The `players` object lives in RAM. Deploy a new version? Every session, every score, every leaderboard position vanishes.

### The moment of realization:

> Junior: "Why is everyone teleporting and one-shotting each other?"
>
> You: "Because you built a database that accepts whatever the client says. The client is not your friend. The client is a cheater waiting to happen."

## Why we start here

This is how every developer builds their first multiplayer server. It's simple. It works in local testing. And it's completely unsuitable for any competitive environment. We keep this version to remember the pain — so we understand why server-authoritative state and anti-cheat exist.

## The fix (next version)

We need types to prevent `req.body.heath` from being ignored. But more importantly, we need **server-authoritative validation** — the server decides what is possible, not the client.
