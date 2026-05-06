# Conflict Resolution Strategies

## Types of Conflicts in Collaborative Whiteboards

1. **Text conflicts**: Two users type in the same text box
2. **Shape conflicts**: Two users move the same rectangle
3. **Deletion conflicts**: One user deletes an object while another edits it
4. **Property conflicts**: One user changes fill color while another changes border color

## Strategy 1: Last-Write-Wins (LWW)

The simplest strategy. Each property has a timestamp. The highest timestamp wins.

```typescript
interface Property<T> {
  value: T;
  timestamp: number; // logical or wall-clock
  userId: string;     // tie-breaker
}

function lwwMerge<T>(a: Property<T>, b: Property<T>): Property<T> {
  if (a.timestamp > b.timestamp) return a;
  if (b.timestamp > a.timestamp) return b;
  return a.userId > b.userId ? a : b; // deterministic tie-break
}
```

**Pros**: Simple, converges quickly
**Cons**: Loses data (the "losing" write is discarded)

## Strategy 2: Multi-Value Register (MV-Register)

Keep **all concurrent values** and let the UI show a conflict.

```typescript
interface MVRegister<T> {
  values: Array<{ value: T; timestamp: number; userId: string }>;
}

function mvMerge<T>(a: MVRegister<T>, b: MVRegister<T>): MVRegister<T> {
  const merged = [...a.values, ...b.values];
  // Remove values that are causally dominated
  const dominant = merged.filter(v1 =>
    !merged.some(v2 => v2.timestamp > v1.timestamp && v2.userId !== v1.userId)
  );
  return { values: dominant };
}
```

**Pros**: No data loss
**Cons**: Requires UI to handle multiple values

## Strategy 3: Operational Transform (OT)

Transform operations so they can be applied in any order. Best for **text**.
(See `02-operational-transform.md` for details.)

## Strategy 4: CRDT Merge Functions

For whiteboard objects, use **CRDTs** with merge semantics:

```typescript
interface WhiteboardObject {
  id: string;
  type: 'text' | 'rectangle' | 'line';
  position: LWWRegister<{ x: number; y: number }>;
  size: LWWRegister<{ width: number; height: number }>;
  fillColor: LWWRegister<string>;
  textContent: SequenceCRDT; // for text boxes
  deleted: EWFlag;           // observed-removed flag
}

function mergeObject(local: WhiteboardObject, remote: WhiteboardObject): WhiteboardObject {
  return {
    ...local,
    position: lwwMerge(local.position, remote.position),
    size: lwwMerge(local.size, remote.size),
    fillColor: lwwMerge(local.fillColor, remote.fillColor),
    textContent: local.textContent.merge(remote.textContent),
    deleted: local.deleted.merge(remote.deleted),
  };
}
```

## Strategy 5: Semantic Resolution

For high-level conflicts, apply **domain rules**:

- **Two users move the same shape**: Average the positions ("both moved it halfway")
- **One deletes, one edits**: Prefer edit (deletion might be accidental)
- **Two users draw overlapping lines**: Keep both; let user resolve manually

```typescript
function semanticResolve(local: ObjectState, remote: ObjectState): ObjectState {
  if (local.deleted && !remote.deleted) {
    // If remote edited after local deleted, keep it
    if (remote.lastModified > local.deletedAt) return remote;
  }
  if (local.type === 'position' && remote.type === 'position') {
    return {
      ...local,
      x: (local.x + remote.x) / 2,
      y: (local.y + remote.y) / 2,
    };
  }
  return lwwMerge(local, remote);
}
```

## Conflict Resolution Matrix

| Conflict Type | Recommended Strategy |
|---|---|
| Text editing | OT or Sequence CRDT |
| Shape position | LWW or semantic average |
| Color / style properties | LWW |
| Deletion vs edit | Semantic (prefer edit if recent) |
| Complex objects | CRDT with per-property merge |

## Undo / Redo in Collaborative Systems

Standard undo (reverse last local operation) breaks in multiplayer because:
- User A inserts "X"
- User B inserts "Y" after it
- User A undoes → should remove "X", but "Y" was inserted after it

**Solution**: **Undo as inverse operation** that is broadcast like any other op.

```typescript
// User A's undo generates an inverse operation
const inverseOp = invertOp(lastLocalOp);
ws.send({ type: 'op', payload: inverseOp });
// All clients apply the inverse, converging correctly
```

## References

- "Conflict Resolution for Eventual Consistency" — Marc Shapiro, INRIA
- "CRDTs and the Quest for Distributed Consistency" — Martin Kleppmann, QCon 2018
