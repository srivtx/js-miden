# E03: DataSync (CRDT Sync Engine)

## Overview

A real-time data synchronization engine inspired by Firebase and Dropbox. Enables offline-first applications that work without connectivity and sync seamlessly when reconnected [1]. Built on CRDTs (Conflict-free Replicated Data Types) for automatic conflict resolution.

## What This Project Does

- **Real-Time Sync**: Push changes to all connected peers instantly
- **Offline-First**: App works offline; syncs on reconnection
- **CRDT Merging**: Automatic conflict resolution without coordination
- **Delta Sync**: Only send changed data, not full documents
- **Presence**: Track who's online and what they're editing

## Architecture

```
┌─────────────┐      WebSocket      ┌──────────────────┐
│  Client A   │◄──────────────────►│   DataSync       │
│ (Offline    │      Sync +        │   CRDT Engine    │
│  Capable)   │     Presence       │   (This Project) │
└──────┬──────┘                    └────────┬─────────┘
       │                                    │
       │         ┌──────────────┐          │
       │         │   Client B   │◄─────────┘
       │         │  (Online)    │
       │         └──────────────┘
       │
       ▼
┌─────────────┐
│   Local     │
│   Storage   │
│  (IndexedDB)│
└─────────────┘
```

## Key Design Decisions

1. **CRDTs over OT**: Operational Transform requires a central server; CRDTs work peer-to-peer [2].
2. **Version Vectors**: Track causality to detect concurrent edits [3].
3. **Delta Sync**: Send only operations, not full state.
4. **Tombstones**: Mark deleted data to prevent resurrection.

## Services

| Service | Responsibility |
|---------|---------------|
| SyncService | WebSocket connections, sync protocol, delta broadcast |
| StorageService | Local document storage, tombstone tracking |
| ConflictResolutionService | CRDT merge logic, vector clock comparison |
| PresenceService | Online/offline status, cursor tracking |

## Known Issues

See [troubleshooting.md](troubleshooting.md) for the tombstone bug.

## References

[1] "How Figma's Multiplayer Technology Works," Evan Wallace, 2019.
[2] Shapiro, M., et al. "Conflict-free Replicated Data Types." SSS 2011.
[3] "Version Vectors: Logical Clocks for Optimistic Replication," IEEE, 1997.
[4] "Firebase Realtime Database Documentation," Google.