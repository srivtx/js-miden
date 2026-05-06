# A06 Evolution: v2 — Add TypeScript

## State of the System

The monolithic `index.js` has been split into typed modules. Every data structure now has an explicit interface, and the compiler catches undefined properties and incorrect status transitions before runtime.

## What Changed

- **Explicit data model.**
  - `ContentItem` — `id`, `userId`, `text`, `status`, `submittedAt`, optional `aiResult`, optional `humanDecision`, optional `publishedAt`.
  - `AIResult` — `flagged`, `categories`, `confidence`, `checkedAt`.
  - `HumanDecision` — `reviewerId`, `decision`, `reason`, `decidedAt`.
  - `HumanReviewQueueItem` — `id`, `contentId`, `status`, `assignedTo`, `createdAt`, `completedAt`.
- **Module boundaries.** `content.ts`, `ai-check.ts`, `human-review.ts`, `audit.ts`, `appeal.ts`, `queue.ts`, `publish.ts`, `storage.ts`, and `index.ts`.
- **Type-safe status transitions.** `ContentItem['status']` is a union: `'submitted' | 'ai_review' | 'human_review' | 'approved' | 'rejected' | 'published'`. Assigning an invalid string is a compile error.
- **Storage abstraction.** `MemoryStorage` is a class with typed methods: `saveContent`, `getContent`, `updateContent`, `saveReviewQueueItem`, `addAuditLog`, etc. This replaces the raw `Map` operations scattered through v1.

## What Still Breaks

- **No validation at runtime.** A malformed POST body still reaches the handler. TypeScript only validates at compile time; a missing `userId` from an external client is still `undefined` at runtime.
- **Race condition untouched.** `humanReview()` reads the content, constructs a `HumanDecision`, and writes back with `storage.updateContent()`. Two concurrent reviewers still overwrite each other.
- **AI check is a mock.** `aiCheck()` uses keyword matching (`text.includes('spam')`). There is no real ML integration, but the `AIResult` interface is ready for it.
- **Audit trail is append-only but not transactional.** `storage.addAuditLog()` and `storage.updateContent()` are separate calls. A crash between them leaves the state updated but the audit missing.

## Code Snapshot (content.ts)

```typescript
export interface ContentItem {
  id: string;
  userId: string;
  text: string;
  status: 'submitted' | 'ai_review' | 'human_review' | 'approved' | 'rejected' | 'published';
  submittedAt: number;
  aiResult?: AIResult;
  humanDecision?: HumanDecision;
  publishedAt?: number;
}

export async function submitContent(body: ContentBody): Promise<ContentItem> {
  const content: ContentItem = {
    id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: body.userId,
    text: body.text,
    status: 'submitted',
    submittedAt: Date.now(),
  };
  await storage.saveContent(content);
  return content;
}
```

## Architectural Notes

This is the "add TypeScript" stage. The domain model is now explicit: content moves through a pipeline (`submitted → ai_review → human_review → approved → published`). The type system enforces that handlers cannot set a content item to an invented status like `"reviewed"`. However, the system still trusts all inputs and does not protect against concurrent modifications.

## Migration Path to v3

1. Add runtime validation with Zod schemas for every route.
2. Enforce that `reviewerId` and `decision` are present and well-formed before calling `humanReview()`.
3. Validate that appeals can only be created for `rejected` content.
