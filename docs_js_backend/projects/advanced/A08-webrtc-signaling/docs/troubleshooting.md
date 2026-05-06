# Troubleshooting

## Known Bugs

### Bug 1: ICE Candidate Memory Leak (CRITICAL)

**Symptom**: Server memory grows continuously. After 24 hours, process uses 2GB+ RAM.

**Root Cause**: `IceRelayService` stores every ICE candidate in a Map but never calls `cleanupOldCandidates()`. Candidates accumulate forever.

**Location**: `src/services/IceRelayService.ts`

**Code**:
```typescript
storeCandidate(roomId, peerId, candidate) {
  const entry = { id, roomId, peerId, candidate, timestamp: Date.now() };
  const roomCandidates = this.candidates.get(roomId) || [];
  roomCandidates.push(entry);
  this.candidates.set(roomId, roomCandidates);
  // BUG: No cleanup! cleanupOldCandidates is defined but NEVER called.
}
```

**Fix**: Call `cleanupOldCandidates()` periodically or after relay:
```typescript
// Option 1: Cleanup after each relay
this.cleanupOldCandidates(30000);

// Option 2: Periodic cleanup
setInterval(() => this.cleanupOldCandidates(30000), 60000);
```

**Test**: `tests/signaling.test.ts` - "BUG: ICE candidates accumulate forever"

## Common Issues

### WebSocket Connection Fails
- Check firewall rules for port 3000
- Verify `WS_PORT` environment variable
- Check nginx `proxy_set_header Connection "upgrade"`

### TURN Server Not Working
- Verify coturn is running: `docker-compose ps turn`
- Test with `turnutils_uclient`
- Check port range 10000-10100 is open

### Room Message Leaks
- Verify `roomId` is included in all messages
- Check `broadcastToRoom` excludes sender if needed

## Debug Logging

Enable verbose logging:
```bash
DEBUG=webrtc:* npm run dev
```

## References

[1] Node.js Memory Leak Detection. https://nodejs.org/en/docs/guides/diagnostics-memory-leak/
[2] WebRTC Troubleshooting Guide, webrtc.org.