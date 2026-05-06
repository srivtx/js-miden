# CRDTs (Conflict-free Replicated Data Types)

## What Is a CRDT?
A **CRDT** is a data structure that can be replicated across multiple nodes, updated independently, and is **guaranteed to converge** to the same state without requiring coordination.

## Core Properties

| Property | Meaning |
|---|---|
| **Commutativity** | `A ∘ B = B ∘ A` — Order of operations does not matter |
| **Associativity** | `(A ∘ B) ∘ C = A ∘ (B ∘ C)` — Grouping does not matter |
| **Idempotence** | `A ∘ A = A` — Applying the same operation twice is safe |

These three properties together guarantee **strong eventual consistency**.

## Example: Two Users Typing (CRDT)

**Initial document**: `Hello world`

**User A** types `!` at the end:
- Operation A: `insert('!', after 'd')`
- (Uses a **position identifier** instead of an integer index)

**User B** deletes the `w`:
- Operation B: `delete(id_of_w)`
- (Uses a **unique ID** for the character, not a numeric index)

Because operations refer to **unique IDs** rather than positions, they commute naturally:

```
User A applies A locally:  Hello world!
User B applies B locally:  Hello orld

When they sync:
- User A receives delete(id_of_w) → removes 'w' → Hello orld!
- User B receives insert('!', after 'd') → adds '!' → Hello orld!

Both converge to: Hello orld!
```

## CRDT Position Identifiers

Instead of integer positions, CRDTs use **fractional indices** or **unique identifiers**:

```
Character IDs:
H: id=1.0
e: id=1.1
l: id=1.2
l: id=1.3
o: id=1.4
 (space): id=1.5
w: id=1.6
o: id=1.7
r: id=1.8
l: id=1.9
d: id=1.10

User A inserts '!' between d and end:
  new id = between(1.10, ∞) = 1.11

User B deletes w:
  delete id=1.6

No position conflicts because operations are ID-based!
```

## Types of CRDTs

### 1. Sequence CRDT (for text)
- **RGA** (Replicated Growable Array)
- **YATA** (Yet Another Transformation Approach)
- **Logoot / LSEQ**
- Used by: Yjs, Automerge

### 2. Register CRDT (for single values)
- **LWW-Register** (Last-Write-Wins): timestamp or vector clock decides winner
- **MV-Register** (Multi-Value): keeps all concurrent values

### 3. Map CRDT (for objects)
- **LWW-Map**: each key is an LWW-Register
- **OR-Map**: Observed-Removed map

### 4. Counter CRDT
- **G-Counter** (Grow-only Counter)
- **PN-Counter** (Positive-Negative Counter)

## Visual: Convergence Guarantee

```
       Initial State: [ ]
            │
      ┌─────┴─────┐
      ▼           ▼
   User A      User B
   insert X    insert Y
      │           │
      ▼           ▼
   State A:    State B:
   [X]         [Y]
      │           │
      └─────┬─────┘
            ▼
      Sync / Merge
            │
            ▼
      Final State:
      [X, Y]  or  [Y, X]
      (both are valid; order
       is deterministic)
```

## Comparison: OT vs CRDT

```
OT (Centralized):
┌─────────┐      ┌─────────┐      ┌─────────┐
│ User A  │◄────►│ Server  │◄────►│ User B  │
│         │      │(sequencer)│      │         │
└─────────┘      └─────────┘      └─────────┘
   Server decides order.
   Clients must wait for server ack.

CRDT (Decentralized):
┌─────────┐◄─────────────────────►┌─────────┐
│ User A  │        P2P sync       │ User B  │
│ (local) │◄─────────────────────►│ (local) │
└─────────┘                       └─────────┘
   Each peer applies locally first.
   Sync is background; no central server required.
```

## CRDT in Code (Simplified Yjs-style)

```typescript
// A simplified sequence CRDT using unique IDs
interface Item {
  id: [number, string]; // [clock, clientId]
  originLeft: [number, string] | null;
  originRight: [number, string] | null;
  content: string | null; // null = deleted
}

class SequenceCRDT {
  private items: Item[] = [];
  private clock = 0;

  insert(index: number, text: string, clientId: string): Item[] {
    const ops: Item[] = [];
    for (const char of text) {
      this.clock++;
      const left = this.items[index - 1]?.id ?? null;
      const right = this.items[index]?.id ?? null;
      const item: Item = {
        id: [this.clock, clientId],
        originLeft: left,
        originRight: right,
        content: char,
      };
      this.items.splice(index, 0, item);
      ops.push(item);
      index++;
    }
    return ops;
  }

  delete(index: number, len: number): Item[] {
    const ops: Item[] = [];
    for (let i = 0; i < len; i++) {
      const item = this.items[index + i];
      if (item) {
        item.content = null; // tombstone
        ops.push(item);
      }
    }
    return ops;
  }

  merge(remoteItems: Item[]) {
    for (const item of remoteItems) {
      if (!this.items.find(i => i.id[0] === item.id[0] && i.id[1] === item.id[1])) {
        // Find correct position based on originLeft / originRight
        const pos = this.findInsertPosition(item);
        this.items.splice(pos, 0, item);
      }
    }
  }

  toString(): string {
    return this.items.filter(i => i.content !== null).map(i => i.content).join('');
  }

  private findInsertPosition(item: Item): number {
    // Simplified: in a real CRDT, this uses the origin IDs
    return this.items.length;
  }
}
```

## When to Use CRDTs

- **Real-time collaboration** where offline support is needed
- **Distributed systems** without a central server
- **Complex data structures** (text, maps, lists) where OT transforms would be too complex
- **Peer-to-peer** architectures

## References

- "A Comprehensive Study of Convergent and Commutative Replicated Data Types" — Shapiro et al., INRIA 2011
- "Yjs: A CRDT Framework" — Kevin Jahns
- "Figma's Engineering Blog: How Figma's Multiplayer Technology Works" — Evan Wallace
