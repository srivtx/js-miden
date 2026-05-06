# The Problem

## What Are We Building?
A geo-distributed API deployed across multiple regions (us-east, us-west, eu-west) with intelligent routing, asynchronous data replication, and conflict resolution. Designed to minimize latency by serving users from their nearest region while maintaining data consistency across the globe.

```
                        ┌─────────────┐
                        │   GeoDNS    │
                        │  (Route 53) │
                        └──────┬──────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌────────────┐  ┌────────────┐  ┌────────────┐
        │  us-east   │  │  us-west   │  │  eu-west   │
        │  (3001)    │  │  (3002)    │  │  (3003)    │
        └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
              │               │               │
              ▼               ▼               ▼
        ┌────────────┐  ┌────────────┐  ┌────────────┐
        │ redis-east │  │ redis-west │  │ redis-eu   │
        └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                        ┌────────────┐
                        │ Conflict   │
                        │ Resolution │
                        └────────────┘
```

## Why Does This Problem Exist?
The speed of light is finite. A user in London calling a server in Virginia experiences ~80ms of network latency — before any application logic runs. For write-heavy applications (shopping carts, gaming state, collaborative editing), that latency is unacceptable.

But deploying to multiple regions introduces the hardest problem in computer science: **consistency across distance**.

- If Alice in New York and Bob in London both update the same shopping cart simultaneously, whose update wins?
- If the transatlantic cable is cut, can users still write data?
- If a write replicates asynchronously, how do we detect that two regions made conflicting changes?

This project teaches how to build systems that choose **availability** and **partition tolerance** (AP in CAP theorem) with **eventual consistency** and **vector clocks** for conflict detection.

## Who Will Use It?
- **Global e-commerce**: Shopping carts, inventory, wishlists
- **Multiplayer games**: Player state, leaderboards, matchmaking
- **Collaborative apps**: Shared documents, design boards, spreadsheets
- **Financial services**: Regional trading, localized account balances

## Constraints
- **Latency**: Read < 10ms from local region. Write < 50ms (ack local, replicate async).
- **Availability**: 99.99% uptime per region. System must work when regions can't communicate.
- **Consistency**: Eventual consistency within 1 second for same-continent regions, 5 seconds for cross-continent.
- **Conflict Resolution**: Concurrent updates must be detected and resolved without silent data loss.

## What We're NOT Building
- We are NOT building strong consistency (Spanner/CockroachDB do that with Paxos — much higher latency)
- We are NOT building a full CRDT implementation (we use vector clocks + merge strategies)
- We are NOT handling Byzantine faults (we assume regions are honest, just partitioned)
- We are NOT implementing consensus (Raft/Paxos) — we prioritize availability over strong consistency

## Real-World Context
In 2011, Amazon published the Dynamo paper, describing how they built a geo-distributed key-value store that sacrifices strong consistency for "always-on" availability. During network partitions, Dynamo continues accepting writes in all regions. When partitions heal, conflicting versions are detected via vector clocks and presented to the application for resolution. This project is a simplified educational implementation of those principles.
