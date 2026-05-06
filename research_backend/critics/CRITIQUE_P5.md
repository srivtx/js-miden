# Critique Report: Project 5 — AI Content Studio

**Reviewer:** Senior Technical Critic  
**Date:** 2026-05-06  
**Verdict:** Contains dangerous code that will fail in production if copied verbatim. The educational value is high but the safety net is full of holes.

---

## Severity Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 7 | 🔴 Must Fix |
| MAJOR | 10 | 🟠 Should Fix |
| MINOR | 8 | 🟡 Polish |
| MISSING | 8 | ⚪ Add |

---

## CRITICAL (Will Cause Incidents If Copied)

### C1. No Input Validation on Stream Endpoints
**Location:** `src/routes/generate.ts`, `src/routes/stream.ts`, all SSE routes  
**Issue:** Every route destructures `req.body.prompt` without validation. If `prompt` is `undefined`, the code passes it to OpenAI, which throws an unhandled exception that leaks the API error directly to the client. If `prompt` is an object/array, OpenAI receives garbage.  
**Fix:** Add Zod/Joi validation before any API call.

### C2. Missing Client Disconnect Handling in SSE
**Location:** `src/routes/stream.ts` (Step 2), `src/routes/rag.ts` (Step 8)  
**Issue:** If the user closes their browser tab mid-stream, the `for await` loop continues consuming the OpenAI stream, burning tokens and money. There is no `req.on('close', ...)` or `AbortController` linkage.  
**Fix:** Attach an AbortController to the request lifecycle and abort the stream on client disconnect.

### C3. Prompt Injection in RAG Pipeline
**Location:** `src/utils/rag.ts` (Section 3.4)  
**Issue:** The `userQuery` is concatenated directly into the augmented prompt string with zero sanitization: `` `User Question: ${userQuery}` ``. A malicious query can override system instructions even if the raw input passed moderation.  
**Fix:** Use structured message arrays for the RAG prompt, never concatenate user input into a template string.

### C4. Race Condition in Async Moderation Middleware (Broken Version)
**Location:** Section 4, Step 4 (first broken snippet)  
**Issue:** The `.then().catch(next)` pattern does not return from the middleware function. If `moderateContent` resolves slowly, Express may have already moved to the next middleware, causing `res.status(400)` to be called on a response that has already started streaming. This crashes the process with "Cannot set headers after they are sent to the client."  
**Fix:** The corrected version is shown, but the broken version should be marked **DANGEROUS — DO NOT USE** more explicitly.

### C5. Rate Limiter Trusts `req.user!` Blindly
**Location:** `src/middleware/rateLimit.ts`  
**Issue:** `const userId = req.user!.id;` uses a non-null assertion. If auth middleware is missing or misordered, this throws a runtime TypeError (`Cannot read properties of undefined`) and crashes the request.  
**Fix:** Guard clause: `if (!req.user) return res.status(401)...`

### C6. Redis Connection Leak in Cache Utility
**Location:** `src/utils/cache.ts`  
**Issue:** `const redis = new Redis(...)` creates a persistent connection that is never closed. In a serverless or test environment, this leaks file descriptors.  
**Fix:** Export a shared Redis instance from a central config file and handle graceful shutdown.

### C7. No Output Moderation
**Location:** Entire project  
**Issue:** The content moderation only checks the user's *input*. OpenAI can still generate harmful, biased, or PII-laden output. The project never discusses output moderation or the legal liability of *generated* content.  
**Fix:** Mention OpenAI output moderation or a secondary filtering layer on the stream.

---

## MAJOR (Outdated, Inefficient, or Brittle)

### M1. Hardcoded `gpt-4` Model Is Outdated and Expensive
**Location:** Throughout  
**Issue:** `gpt-4` (the original 8k context model) is legacy. `gpt-4o` or `gpt-4o-mini` are cheaper, faster, and have larger context windows. The pricing table shows 2023-era pricing. Students will copy this and burn money.  
**Fix:** Update to `gpt-4o-mini` for drafts and `gpt-4o` for production, with current pricing.

### M2. No Rate Limiting on Semantic Search Endpoint
**Location:** `src/routes/search.ts`  
**Issue:** `POST /search` calls `generateEmbedding()` which is a paid OpenAI API call. A bot can hammer this endpoint and rack up embedding costs with no restriction.  
**Fix:** Apply the same token-based rate limiter to search.

### M3. Missing Error Handling in Background Job Worker
**Location:** `src/jobs/embeddings.ts`  
**Issue:** The BullMQ worker has no `try/catch` inside the processor. If `generateEmbedding()` throws (network blip, OpenAI outage), BullMQ will mark the job as failed and retry, but there's no logging or dead-letter handling for embedding jobs.  
**Fix:** Wrap in try/catch, log to a monitoring system, and configure BullMQ retry limits.

### M4. Global `encoding_for_model` Instance
**Location:** `src/utils/tokens.ts`  
**Issue:** `const encoder = encoding_for_model('gpt-4');` is created at module load. `js-tiktoken` encoders are large objects (~5MB). In a worker-thread or cluster setup, each process loads its own copy.  
**Fix:** Lazily initialize or use `tiktoken` lite methods.

### M5. No Database Transaction for Generation → Embedding Queue
**Location:** `src/routes/generate.ts` (implied)  
**Issue:** The flow is: (1) save generation to DB, (2) add embedding job to queue. If (1) succeeds and (2) fails (Redis down), the generation exists but never gets embedded. Over time, search becomes incomplete.  
**Fix:** Use a transactional outbox pattern or at least log the inconsistency.

### M6. Cache Simulation Blocks the Event Loop
**Location:** `src/routes/generate.ts` (cache usage snippet)  
**Issue:** `await new Promise((r) => setTimeout(r, 20))` inside a `for...of` loop over words blocks the event loop for the duration of the cached response. A 500-word response = 10 seconds of micro-tasks.  
**Fix:** Use a streaming approach or `setImmediate`/`setTimeout` per chunk without `await` in a tight loop.

### M7. Missing `max_tokens` Bound on Response
**Location:** `src/middleware/rateLimit.ts`  
**Issue:** `MAX_TOKENS_PER_REQUEST = 4000` is checked against the *prompt* only. The OpenAI call is not constrained by `max_tokens`, so a 3000-token prompt could generate a 4000-token response, totaling 7000 tokens and blowing the budget intent.  
**Fix:** Pass `max_tokens: MAX_TOTAL_TOKENS - promptTokens` to the API.

### M8. No Request Idempotency
**Location:** Entire project  
**Issue:** If a client's network flakes and they retry a generation request, they get billed twice for the same prompt. No `Idempotency-Key` header handling is discussed.  
**Fix:** Add idempotency key handling with Redis deduplication.

### M9. Environment Variables Use Non-Null Assertions
**Location:** Every file with `process.env.XXX!`  
**Issue:** `process.env.OPENAI_API_KEY!` suppresses TypeScript errors but does nothing at runtime. If the env var is missing, the OpenAI client throws an opaque error deep in the stack.  
**Fix:** Validate env vars at startup with `envalid` or `zod` and fail fast.

### M10. `pgvector` Listed as npm Dependency
**Location:** Prerequisites  
**Issue:** `pnpm add pgvector` is misleading. `pgvector` is a PostgreSQL extension, not a Node client library. The project uses `postgres` (postgres.js) which handles vectors via `sql.array()`. This will confuse students who think they need an npm package.  
**Fix:** Remove `pgvector` from the npm install line.

---

## MINOR (Typos, Inconsistencies, Edge Cases)

1. **Inconsistent import extensions:** Some files import `../utils/sse.js` (correct for ESM), others omit the extension.
2. **Docker Compose uses `ankane/pgvector:latest`:** Should pin to a specific version tag (e.g., `pgvector:v0.7.4`) for reproducibility.
3. **Typo in Bug 2 fix:** The fix checks `if (req.body.prompt.includes('Ignore previous instructions'))` — this is security theater. A student will think keyword filtering stops prompt injection. The text should explicitly say this is illustrative and insufficient.
4. **SSE `error()` helper doesn't end the response:** If `sse.error()` is called, the connection stays open until `sse.end()` is called separately. In some error paths, `sse.end()` might be forgotten.
5. **Missing `return` after cached response:** The cache hit snippet streams the response but doesn't `return` from the handler, allowing fall-through to the real API call.
6. **`removeOnComplete: 100` on embedding queue:** Not shown in the code, but if BullMQ is used, completed jobs accumulate in Redis. Students copying this will have memory issues.
7. **No pagination on semantic search:** `LIMIT 10` is fine for a demo, but no cursor or offset is discussed for large result sets.
8. **The `similarity` formula comment says 0.7+ is "similar":** For `text-embedding-3-small`, cosine similarity of 0.7 is actually quite weak. 0.85+ is a better threshold.

---

## MISSING (What Should Be Covered)

1. **Output moderation / PII redaction:** AI outputs can contain personal data. No discussion of output filtering or data retention policies.
2. **Model fallback strategy:** If OpenAI is down or rate-limits, what happens? No fallback to another model or provider.
3. **Context window overflow handling:** GPT-4 has limited context. No discussion of what happens when prompt + RAG context exceeds the limit.
4. **Client-side SSE reconnection state:** The project says SSE auto-reconnects, but doesn't discuss how to handle duplicate chunks on reconnect.
5. **Embedding model costs:** `text-embedding-3-small` pricing is not mentioned. Students should know embeddings are cheap but not free.
6. **Log redaction:** Prompts may contain PII. No discussion of sanitizing logs before sending to Datadog/Sentry.
7. **Temperature tuning per content type:** Blog, social, and email should have different `temperature` values. Not discussed.
8. **API versioning for the AI endpoints themselves:** The project discusses API versioning in P8 but not here. If the AI model changes, the prompt behavior changes — how do you version that?

---

## EDUCATIONAL QUALITY

### What Works
- The **conceptual explanations** of SSE vs WebSockets, embeddings, and RAG are excellent. The ASCII diagrams are genuinely helpful.
- **Bug 5 (Missing HNSW Index)** is a perfect teaching moment — it connects database theory to production performance.
- The **cost math** in Section 6 is eye-opening and necessary.

### What Fails
- **Bug 2 (Prompt Injection) fix is dangerously naive.** Teaching students to check for literal strings like `"Ignore previous instructions"` gives them false confidence. The fix should emphasize structural separation (system vs user messages) and output moderation, not keyword blacklists.
- **The moderation middleware bug** shows a broken async pattern that could crash an Express server. This is too dangerous to present as a "learning exercise" without a giant red warning.
- **No discussion of what happens when the *client* disconnects.** In streaming apps, this is the #1 source of wasted API spend.

### Recommendation
**Do not ship this project to students without:**
1. Adding input validation to every endpoint.
2. Fixing the SSE disconnect/AbortController pattern.
3. Removing the keyword-based prompt injection "fix" and replacing it with a real architectural discussion.
4. Updating model references from `gpt-4` to `gpt-4o-mini` / `gpt-4o`.

---

*End of Critique P5*
