# E03 Data Sync: The Problem

## What Problem Are We Solving?

Modern applications run on multiple devices simultaneously. A user edits a Google Doc on their laptop, then switches to their phone. A team collaborates on a Figma file across three time zones. A warehouse worker scans inventory on a handheld device while the ERP system updates from the office.

The challenge: **How do you keep all these copies of data consistent when network is intermittent, latency is high, and edits happen concurrently?**

Traditional approaches fail:
- **Last-write-wins (LWW)**: Alice types "Hello" on her laptop. Bob types "World" on his phone. LWW keeps only one. Data is silently lost.
- **Lock-based sync**: Alice locks the document. Bob can't edit until Alice finishes and syncs. Unusable for real-time collaboration.
- **Central server as bottleneck**: All changes route through a single server. If the server is down or the network is slow, work stops.

CRDTs (Conflict-Free Replicated Data Types) solve this by making conflicts mathematically impossible. Every peer can edit independently, and when they sync, the data structures merge automatically into a consistent state.

## Core Requirements

| Requirement | Why It Matters |
|-------------|---------------|
| **Eventual consistency** | Peers may be offline for days. When they reconnect, state must converge without human intervention. |
| **Conflict-free merging** | Concurrent edits must not lose data. Both "Hello" and "World" must survive in some form. |
| **Tombstone propagation** | When Alice deletes a document on her laptop, Bob's phone must eventually delete it too. Without tombstones, deletions resurrect. |
| **Incremental sync** | Don't send the entire database on every reconnect. Send only what's changed (deltas). |
| **Vector clocks** | Determine causality without central timestamps. Peer A's clock `{A: 5, B: 3}` means "I've seen 5 of my own events and 3 of B's." |

## The Specific Domain: Real-Time Collaborative Document Sync

This system handles:
- **CRDT documents**: Registers (single values), maps (key-value), lists (ordered sequences)
- **Delta sync**: Send only changed operations, not full documents
- **Conflict resolution**: Vector clock comparison to detect concurrent vs causal updates
- **Presence**: Track who's online and where their cursor is

## Real-World Context

- **Figma**: Uses CRDTs for real-time design collaboration. 100+ designers can edit the same file simultaneously.
- **Notion**: Uses OT (Operational Transformation) for document sync, a cousin of CRDTs.
- **Yjs**: The most popular JavaScript CRDT library. Powers apps like Relm, GitHub Copilot Chat, and many startups.
- **Apple Notes**: Uses CRDTs for offline-first note syncing across iPhone, iPad, and Mac.
- **Riak**: Distributed database using CRDTs for conflict resolution in the NoSQL era.

## Why CRDTs Matter

Before CRDTs (2000s-2010s):
- **Operational Transformation (OT)**: Used by Google Docs. Complex, requires a central server, hard to reason about.
- **Manual conflict resolution**: Git-style merge conflicts for everything. Users hate this.
- **Eventual consistency with CRDTs (2011+)**: Shapiro et al. formalized CRDTs. Now anyone can build Google Docs-style collaboration.

## The Sync Model

```
PEER A (Laptop)              SERVER / PEER B (Phone)
───────────────              ────────────────────────
   │                                  │
   │ Create doc-1                     │
   │ VC: {A: 1}                       │
   │                                  │
   │ ─────────── sync ──────────────▶│
   │                                  │ Stores doc-1
   │                                  │ VC: {A: 1}
   │                                  │
   │ Delete doc-1                     │
   │ VC: {A: 2}                       │
   │                                  │
   │ ─────────── delta ─────────────▶│
   │   {type: 'delete', doc: 'doc-1'}│
   │                                  │ Applies deletion
   │                                  │ VC: {A: 2}
   │                                  │
   │ [GOES OFFLINE]                   │
   │                                  │
   │ [COMES BACK ONLINE]              │
   │                                  │
   │ ─────────── sync req ──────────▶│
   │   "What do you have?"            │
   │                                  │ Sends: []
   │                                  │   (doc-1 is deleted)
   │                                  │   + tombstones
   │                                  │
   │ Receives tombstone               │
   │ Confirms deletion                │
```

Without tombstones, Peer B would send `doc-1` back to Peer A, resurrecting it.
