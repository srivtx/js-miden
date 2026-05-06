# A08 Evolution: v4 — Add Logging

## State of the System

Every signaling event is logged as structured JSON. Logs include peer IDs, room IDs, message types, and ICE candidate counts. Memory leaks and stale presence are now observable.

## What Changed

- **Structured JSON logger.** `logInfo()` and `logError()` output single-line JSON with `level`, `message`, `timestamp`, and metadata.
- **Per-event logging.** `join` → logs `peerId`, `roomId`, `peerCount`. `leave` → logs `peerId`, `roomId`, `remainingPeers`. `offer`/`answer` → logs `from`, `to`, `roomId`, `sdpLength`. `ice-candidate` → logs `peerId`, `roomId`, `candidateType`.
- **Health endpoint metrics.** `GET /api/health` returns `peers`, `rooms`, and `iceCandidates` counts. This enables external monitoring (e.g., Prometheus node exporter scraping).
- **ICE candidate count tracking.** `IceRelayService.getCandidateCount()` and `getRelayCount()` expose the current memory pressure from stored candidates.

## What Still Breaks

- **Memory leak is logged but not fixed.** The health endpoint shows `iceCandidates` growing indefinitely, but `cleanupOldCandidates()` is never called.
- **Stale presence is logged but not fixed.** `PresenceService.getPresenceInRoom()` returns ghost peers, but `cleanupStalePresence()` is never scheduled.
- **No rate limiting.** A peer sending 1,000 candidates per second produces 1,000 log lines and 1,000 stored entries.
- **No WebSocket ping/pong.** Abrupt disconnections are detected only when the server tries to write to the socket. This can take minutes.

## Code Snapshot (services/IceRelayService.ts)

```typescript
relayCandidate(roomId: string, peerId: string, candidate: RTCIceCandidateInit, targetPeerId?: string): boolean {
  this.storeCandidate(roomId, peerId, candidate);
  this.relayCount++;
  logInfo('ICE candidate relayed', { roomId, peerId, targetPeerId, candidateCount: this.getCandidateCount() });
  // BUG: No cleanup — candidateCount grows forever
  // this.cleanupOldCandidates(30000);
  // ...
}
```

## Architectural Notes

This is the "TURN + observability" stage. The system now exposes real-time metrics for peer count, room count, and ICE candidate memory usage. An operator can watch `iceCandidates` climb and know a leak exists. However, the leak is not automatically fixed; the operator must restart the process.

## Migration Path to v5

1. Add Vitest tests that assert `cleanupOldCandidates()` removes expired entries.
2. Schedule `setInterval` for candidate cleanup (30s TTL) and presence cleanup (60s TTL).
3. Add WebSocket ping/pong every 15 seconds to detect dead connections.
