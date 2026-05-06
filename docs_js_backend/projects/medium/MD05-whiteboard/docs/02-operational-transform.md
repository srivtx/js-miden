# Operational Transform (OT)

## The Problem
Two users type in the same document at the same time. Without coordination, their changes overwrite each other.

## Example: Two Users Typing

**Initial document**: `Hello world`

**User A** types `!` at the end (position 11):
- Operation A: `insert('!', 11)`
- Document becomes: `Hello world!`

**User B** simultaneously deletes the `w` at position 6:
- Operation B: `delete(1, 6)`
- Document becomes: `Hello orld`

If both send their operations to each other **without transformation**, User A receives `delete(1, 6)` and deletes the wrong character (the `o` in `world!`), resulting in `Hell world!`.

## The Transform Function

OT defines a function `transform(opA, opB)` that adjusts `opA` to account for `opB` having already been applied.

### Transform Rule for Insert vs Delete

If `opB` is `delete(1, 6)` and `opA` is `insert('!', 11)`:
- `opB` deleted a character **before** position 11
- Therefore, `opA`'s insertion position must shift left by 1
- **Transformed opA**: `insert('!', 10)`

```
User A: insert('!', 11)
User B: delete(1, 6)

Transform(insert('!', 11), delete(1, 6))
  → insert('!', 10)   // because one char was deleted before pos 11

Result: Hello orld!
```

## Visual Walkthrough

```
Initial:  H e l l o   w o r l d
          0 1 2 3 4 5 6 7 8 9 10

Step 1: User A inserts '!' at 11 locally
        H e l l o   w o r l d !
        0 1 2 3 4 5 6 7 8 9 10 11

Step 2: User B deletes 'w' at 6 locally
        H e l l o   o r l d
        0 1 2 3 4 5 6 7 8 9

Step 3: Server receives both operations
        Server applies A first, then transforms B against A:
        B': delete(1, 6) → still delete(1, 6) because A was after pos 6
        Result: Hello orld!

        Server applies B first, then transforms A against B:
        A': insert('!', 11) → insert('!', 10) because B deleted before 11
        Result: Hello orld!

Both paths converge to the same document!
```

## OT with a Central Server

Most OT systems (like historical Google Docs) use a **central server** as the single source of truth:

```
Client A                    Server                    Client B
   │                          │                          │
   │──opA: ins('!', 11)─────▶│                          │
   │                          │──transform(opA, opB)────▶│
   │                          │                          │
   │◀──ack + transformed─────│                          │
   │                          │◀────opB: del(1, 6)───────│
   │                          │──transform(opB, opA)────▶│
   │◀────transformed opB─────│                          │
   │                          │                          │◀──ack──│
```

**Key invariant**: All clients eventually see operations in the **same order** (the server's order).

## OT Operation Types

| Operation | Description | Transform Rule (simplified) |
|---|---|---|
| `insert(text, pos)` | Insert text at position | If other op is `insert` at same pos, break tie by user ID. If `delete` before pos, shift pos. |
| `delete(len, pos)` | Delete `len` characters at `pos` | If other op inserts before pos, shift pos right. If other op deletes overlapping range, adjust length. |
| `retain(len)` | Skip `len` characters (used in diff-based OT) | Pass through; no effect on position. |

## The Complexity Trap

OT requires transform functions for **every pair of operation types**:
- insert vs insert
- insert vs delete
- insert vs format (bold, italic)
- delete vs delete
- format vs format
- ...and combinations with cursors, undo, redo

As the number of operation types grows, the number of transform functions grows quadratically. This is why OT is historically complex and bug-prone.

## OT in Code (Simplified)

```typescript
type Op = { type: 'insert'; text: string; pos: number }
       | { type: 'delete'; len: number; pos: number };

function transform(a: Op, b: Op): Op {
  if (a.type === 'insert' && b.type === 'delete') {
    if (a.pos > b.pos) {
      return { ...a, pos: a.pos - b.len };
    }
    return a; // no overlap
  }
  if (a.type === 'delete' && b.type === 'insert') {
    if (a.pos >= b.pos) {
      return { ...a, pos: a.pos + b.text.length };
    }
    return a;
  }
  if (a.type === 'insert' && b.type === 'insert') {
    if (a.pos > b.pos || (a.pos === b.pos && a.text > b.text)) {
      return { ...a, pos: a.pos + b.text.length };
    }
    return a;
  }
  // ... more cases
  return a;
}
```

## When to Use OT

- **Centralized architecture** with a trusted server
- **Text editing** where operations are mostly linear (insert/delete)
- **Legacy systems** (e.g., maintaining a Google Docs clone)
- **Small operation sets** where you can verify all transform pairs

## References

- "Operational Transformation in Real-Time Group Editors" — Sun & Ellis, 1998
- "Google Docs' OT Algorithm" — Google Engineering Blog
