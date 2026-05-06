# E03 Data Sync: Real-World Bugs & Impact

## Bug 1: Missing Tombstones → Deleted Data Resurrection

### The Dropbox "Zombie File" Bug (2014)
**What happened**: Users reported that files they had deleted reappeared on other devices after syncing. Dropbox's sync protocol did not properly propagate deletion markers in certain edge cases.

**Root cause**: Deletion metadata was lost during sync reconciliation, especially when devices were offline during the deletion.

**Impact**: User confusion, potential privacy breaches (deleted sensitive files reappearing), reputational damage.

**Our bug**: The `SyncService.handleSyncRequest` sends documents but not tombstones. When Peer 2 connects, it receives no deletion information. If Peer 2 had an old copy of the document, it would recreate it.

### The Google Drive Sync Conflict (2017)
**What happened**: Users experienced duplicate files with "(1)", "(2)" suffixes appearing constantly. Google Drive's sync client created duplicates instead of resolving conflicts properly.

**Root cause**: While not exactly tombstone-related, it shows the consequences of poor sync semantics. Users lost trust in the sync engine.

**Our bug**: Without tombstones, every sync is a potential resurrection event. Users see "zombie data" that refuses to stay deleted.

---

## Bug 2: Wrong Conflict Resolution → Silent Data Loss

### The Apple Notes Sync Bug (2016)
**What happened**: Users reported that notes edited on multiple devices would lose content. Changes made on an iPhone would overwrite changes made on a Mac, even if the Mac changes were newer.

**Root cause**: Apple's sync used a simplified last-write-wins mechanism that didn't properly handle concurrent edits.

**Impact**: Users lost important notes, passwords, and work. No recovery possible.

**Our bug**: The `ConflictResolutionService` uses LWW (Last-Write-Wins) based on timestamp. If clocks are skewed (Peer A's clock is 5 minutes behind Peer B), the "earlier" edit can overwrite the "later" one.

### The Notion Data Loss Incident (2020)
**What happened**: A Notion outage led to data loss for some users. While Notion uses OT (not CRDTs), the incident highlighted how sync failures can destroy user trust.

**Impact**: Notion had to restore from backups. Some users lost hours of work.

---

## Bug 3: No Causal Delivery → Out-of-Order Operations

### The Figma "Ghost Cursor" Bug (2019)
**What happened**: In rare cases, cursor positions would desync, showing a user's cursor in the wrong location. This was caused by out-of-order message delivery in the real-time sync layer.

**Root cause**: WebSocket messages can arrive out of order under network congestion. Without causal tracking, the application applies operations in the wrong sequence.

**Impact**: Minor UI glitches. Figma's robust CRDT layer prevented data loss, but the UX was degraded.

**Our bug**: The current implementation does not enforce causal delivery. A `delete` operation could arrive before the `create` it depends on, causing errors.

---

## Prevention Checklist

- [ ] Include tombstones in every sync response
- [ ] Store tombstones indefinitely (or with garbage collection after all peers ack)
- [ ] Use vector clocks, not timestamps, for causality
- [ ] Handle out-of-order delivery with a pending operations buffer
- [ ] Test sync with simulated network partitions (Chaos Monkey for sync)
- [ ] Test concurrent edits from 3+ peers simultaneously
- [ ] Verify deletion propagation with offline peers
- [ ] Use state-based CRDTs if causal broadcast is too complex
- [ ] Implement undo/redo on top of CRDT history
- [ ] Encrypt sync traffic end-to-end (the server shouldn't read user data)
