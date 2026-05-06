# v2 — Add TypeScript (Note API)

## The Scenario

It's 2am. Your junior is debugging why note updates sometimes clear the title. "I'm sending `title` in the PUT request," they insist. You check: the client sends `title`, but the handler destructures `{ titel, content }`. JavaScript assigns `undefined` to both.

## The PAIN: Silent Failures in Data Handling

From v1:

```javascript
app.put('/notes/:id', async (req, res) => {
  const { titel, content } = req.body; // typo: 'titel'
  await client.query(
    'UPDATE notes SET title = $1, content = $2 WHERE id = $3',
    [titel, content, req.params.id]
  );
  // Both fields become undefined. The note is wiped.
});
```

No error. No crash. The database happily stores `NULL` values. The user sees their note title disappear. They think it's a bug in the app. It is — but JavaScript didn't tell anyone.

## The Solution: TypeScript Interfaces

```typescript
// types.ts
export interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // soft delete
}

export interface CreateNoteInput {
  title: string;
  content: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
}

export interface ListNotesQuery {
  page?: string;
  limit?: string;
  q?: string; // search query
}
```

```typescript
// routes.ts
import { Request, Response } from 'express';
import { Note, CreateNoteInput, UpdateNoteInput } from './types.js';

router.put('/notes/:id', async (req: Request, res: Response) => {
  const input: UpdateNoteInput = req.body;
  // ^ TypeScript enforces: only 'title' and 'content' are valid keys
  // Typo 'titel' -> Compile error: Property 'titel' does not exist
  
  const result = await pool.query(
    'UPDATE notes SET title = COALESCE($1, title), content = COALESCE($2, content), updated_at = NOW() WHERE id = $3 RETURNING *',
    [input.title, input.content, req.params.id]
  );
  res.json(result.rows[0]);
});
```

### What TypeScript catches:

| Scenario | JavaScript | TypeScript |
|----------|-----------|------------|
| `req.body.titel` | Runtime `undefined` | **Compile error**: Property 'titel' does not exist |
| Pass string where number expected | Runtime NaN behavior | **Compile error**: Type 'string' not assignable to 'number' |
| Return extra fields | Client might depend on them | **Compile error**: Type doesn't match interface |
| Forget `deletedAt` in query | Hard-deleted notes appear | **Compile warning**: Property might be undefined |

## The New PAIN: SQL Still Doesn't Know About Types

```typescript
const result = await pool.query('SELECT * FROM notes WHERE id = $1', [id]);
const note: Note = result.rows[0]; // Type assertion
// What if the query is wrong? What if columns are NULL?
```

PostgreSQL returns `any[]`. TypeScript believes your assertion. A wrong query or schema mismatch still breaks at runtime.

## The Realization

> Junior: "TypeScript stopped me from pushing a bug where I misspelled 'title' in the update handler."
> 
> You: "That's the power. But notice: TypeScript doesn't protect your SQL. You can still write `WHERE id = '${id}'` and get injection. Types are for code. Validation is for data."

## Why this matters for Note API

Our search functionality is especially type-sensitive:
- `q?: string` — optional search parameter
- `page?: string` — query params are always strings, need parsing
- `limit?: string` — must be coerced to number

Without types, you forget to parse `page` and pass the string `"2"` to SQL. PostgreSQL might accept it... or not. With types, the compiler forces you to handle the conversion.

## Next: v3 — Add Validation
