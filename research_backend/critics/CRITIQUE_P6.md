# Critique Report: Project 6 — Distributed Job Queue

**Reviewer:** Senior Technical Critic  
**Date:** 2026-05-06  
**Verdict:** Solid architecture concepts undermined by incorrect BullMQ API usage, dangerous process management patterns, and a critical bug in the "fixed" code that students are likely to copy.

---

## Severity Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 8 | 🔴 Must Fix |
| MAJOR | 11 | 🟠 Should Fix |
| MINOR | 8 | 🟡 Polish |
| MISSING | 8 | ⚪ Add |

---

## CRITICAL (Will Cause Incidents If Copied)

### C1. BullMQ `onFailed` Used as Constructor Option
**Location:** Section 3.2 (DLQ) and Section 4.8  
**Issue:** The code shows `new Worker('video-transcode', processor, { connection: redis, onFailed: async (job, err) => { ... } })`. **This is not valid BullMQ 5 API.** `onFailed` is an event, not a constructor option. Passing it here does nothing. Students will copy this and wonder why their DLQ never fires.  
**Fix:** `worker.on('failed', async (job, err) => { ... })` after constructing the worker.

### C2. DLQ Example Creates a Second Worker Just to Listen
**Location:** Section 4.8  
**Issue:** The code creates `const transcodeWorker = new Worker('video-transcode', async (job) => { ... })` *just* to attach a `failed` listener. This worker immediately starts competing for jobs, meaning there are now two worker instances processing the same queue (the "real" one plus this ghost). This causes duplicate processing and race conditions.  
**Fix:** Attach the event listener to the existing worker instance, or use `QueueEvents` for monitoring.

### C3. Unhandled Promise Rejections in `setInterval`
**Location:** `workers/transcode.ts`, `runFfmpeg()` function  
**Issue:** `setInterval(async () => { await job.updateProgress(...) }, 500)` fires overlapping async callbacks. If `updateProgress` rejects (Redis blip), the rejection is swallowed because `setInterval` callbacks don't propagate errors. Node.js will emit an `unhandledRejection` and potentially crash in newer versions.  
**Fix:** Use a `while` loop with `await delay(500)` inside the worker processor, or wrap in `try/catch`.

### C4. Zombie ffmpeg Processes on Worker Crash
**Location:** `workers/transcode.ts` (simulation) and Bug 2 fix  
**Issue:** The "fix" for Bug 2 shows `finally { if (proc && !proc.killed) proc.kill('SIGKILL') }`. However, if the Node.js process itself crashes (OOM, segfault), the `finally` block never runs. The ffmpeg child process becomes an orphan, consuming CPU/disk indefinitely.  
**Fix:** Discuss process groups (`detached: false` or `kill(-pid)` on Linux) and worker heartbeat monitoring.

### C5. No Input Validation on Upload Endpoint
**Location:** `routes/upload.ts` (Section 4.3)  
**Issue:** `req.body.userId` and `req.body.originalUrl` are passed directly to the database. While parameterized queries prevent SQL injection, invalid UUIDs will cause database errors that bubble up as 500s with full stack traces. Malformed URLs could cause ffmpeg to hang or access internal resources.  
**Fix:** Validate with Zod: URL format, UUID format, file extension whitelist.

### C6. Command Injection Risk in Simulation Pattern
**Location:** `workers/transcode.ts`, `runFfmpeg()`  
**Issue:** The simulation uses `spawn('sh', ['-c', 'sleep 2 && echo "done"'])`. If a student replaces this with "real" ffmpeg but keeps the `spawn('sh', ['-c', ...])` pattern and interpolates user input (video URL), they have a direct command injection vulnerability.  
**Fix:** Never show `spawn('sh', ['-c', ...])` in production-facing code. Use `spawn('ffmpeg', ['-i', input, ...])` with array arguments only.

### C7. SSE Progress Endpoint Leaks Redis Subscribers on Errors
**Location:** `routes/progress.ts` (Section 4.9)  
**Issue:** `await subscriber.subscribe(...)` can throw if Redis is unavailable. The error is unhandled and crashes the request. Even if it succeeds, if the client disconnects before `req.on('close')` fires, the subscriber may never be cleaned up.  
**Fix:** Wrap in `try/finally` and use `subscriber.quit()` in a more robust cleanup handler.

### C8. Missing Authentication on Admin Endpoints
**Location:** `routes/dashboard.ts` (Section 4.10)  
**Issue:** `/admin/dlq` and `/retry/:jobId` are completely unauthenticated. Any internet rando can inspect failed jobs and retry them, potentially re-triggering expensive or dangerous work.  
**Fix:** Add middleware to check admin API keys or session before exposing job control.

---

## MAJOR (Outdated, Inefficient, or Brittle)

### M1. No Job Timeout Configuration
**Location:** All worker definitions  
**Issue:** BullMQ supports `timeout` on jobs. A hung ffmpeg process will hold a worker lock forever. With `lockDuration: 30000` and no job timeout, a stalled ffmpeg blocks the worker until manual intervention.  
**Fix:** Set `timeout: 600000` (10 min) on transcode jobs and `stalledInterval` checks.

### M2. `Promise.all` for Queue Adds Has No Partial Failure Handling
**Location:** `routes/upload.ts`  
**Issue:** `await Promise.all([transcodeQueue.add(...), thumbnailQueue.add(...), audioQueue.add(...)])`. If the transcode add succeeds and thumbnail fails, the video will be partially processed with no record of the missing thumbnail job.  
**Fix:** Use a saga or transaction outbox. At minimum, catch individual failures and log them.

### M3. No Duplicate Job Detection
**Location:** `routes/upload.ts`  
**Issue:** A user double-clicking "Upload" or retrying due to network error creates duplicate jobs for the same video. The idempotency check happens in the *worker*, but the queue still gets flooded.  
**Fix:** Use deterministic job IDs (`jobId: videoId + ':transcode'`) so BullMQ deduplicates.

### M4. Progress Race Condition Fix Is Theoretical Only
**Location:** Bug 5 (Section 5)  
**Issue:** The text explains the progress race condition beautifully, but the *actual worker code* in Section 4.4 still calls `await updateVideoStatus(videoId, 'processing')` and `await job.updateProgress(...)` from a single worker. However, if multiple workers run (as the Docker Compose shows: 4 replicas), they still race on the `videos.progress` column. The "fix" suggests aggregating on read but never updates the worker code.  
**Fix:** Remove `progress` from the `videos` table and compute it from `job_logs` or job states on read.

### M5. Database Connection Pool Is Invisible
**Location:** `lib/db.js` (imported but never shown)  
**Issue:** Every worker imports `db` from `../lib/db.js`, but this file is never shown in the build guide. Students have no idea how to configure connection pooling, SSL, or error handling.  
**Fix:** Include the database config file explicitly.

### M6. Job Logs Table Uses Stringified JSON for JSONB
**Location:** `workers/transcode.ts`, `logEvent()` function  
**Issue:** `metadata ? JSON.stringify(metadata) : null` passed to a `JSONB` column. The `pg` driver handles JSONB natively — stringifying may cause double-quoting or escaping issues depending on driver version.  
**Fix:** Pass the object directly: `metadata || null`.

### M7. Saga Implementation Lacks Compensation Retry
**Location:** Section 3.7  
**Issue:** The `VideoProcessingSaga` runs undo functions but if `deleteTranscodes()` fails (file locked by ffmpeg), it just logs and continues. The system is now in an inconsistent state with partial files.  
**Fix:** Implement compensation retries with exponential backoff and human alerting.

### M8. Missing Health Check Endpoints
**Location:** Entire project  
**Issue:** Workers and API need `/health` endpoints for Docker/Kubernetes health checks. Without them, a crashed worker may not be restarted.  
**Fix:** Add a lightweight health check that verifies Redis and DB connectivity.

### M9. No Graceful Shutdown for ffmpeg Child Processes
**Location:** `lib/queues.ts` (Section 4.2)  
**Issue:** The graceful shutdown handler closes BullMQ queues and Redis, but does not terminate active ffmpeg processes. On SIGTERM, running jobs are killed mid-process, leaving corrupt output files that pass the idempotency check on retry.  
**Fix:** Track active child processes in a global Set and `kill` them during shutdown.

### M10. No Storage Quota or File Validation
**Location:** Upload flow  
**Issue:** A user can upload a 100GB file or a malicious executable. There's no file size limit, MIME type check, or storage quota per user.  
**Fix:** Add presigned URL validation, file size limits, and MIME whitelisting.

### M11. Docker Compose `depends_on` Is Insufficient
**Location:** `docker-compose.yml`  
**Issue:** `depends_on` only ensures container start order, not readiness. Workers will crash-loop if they start before Redis/Postgres are accepting connections.  
**Fix:** Use `healthcheck` conditions in depends_on or a startup wait script.

---

## MINOR (Typos, Inconsistencies, Edge Cases)

1. **BullMQ `removeOnFail: 50` conflicts with DLQ:** If a job fails and is moved to DLQ, it is also counted toward the 50-failed limit. If the queue is busy, jobs may be removed from Redis before the DLQ handler inspects them.
2. **Inconsistent video ID formats:** The brief uses `vid_4821` (string), but the schema uses `UUID`.
3. **`runFfmpeg` simulation uses `spawn('sh', ...)` instead of `spawn('ffmpeg', ...)`:** This is fine for simulation but should be marked explicitly as **SIMULATION ONLY — DO NOT USE IN PRODUCTION**.
4. **`updateVideoStatus` doesn't validate the status enum:** The database has a `CHECK` constraint, but a typo in the worker code (e.g., `'procesing'`) causes a database error mid-job.
5. **Missing `return` in some worker examples:** The thumbnail and audio workers export the worker but don't show how they're imported/started.
6. **`db.query` in `updateVideoStatus` uses global pool:** If the worker has many concurrent updates, this competes for pool connections unnecessarily.
7. **Metrics endpoint returns `text/plain` without `# HELP` / `# TYPE` annotations:** Prometheus will scrape it but won't parse metadata correctly.
8. **No `await` on `redis.publish()` in progress updates:** If Redis is down, the publish fails silently.

---

## MISSING (What Should Be Covered)

1. **Webhook notifications:** The user stories mention "email/push when done" but only SSE progress is implemented. No webhook retry logic or signature verification.
2. **File cleanup on permanent failure:** If a job lands in the DLQ, partially written files remain on disk. No cleanup job is discussed.
3. **Priority inversion / starvation:** Paid users get priority 1, but if 1,000 paid users upload simultaneously, free users may never be processed. No discussion of fair queuing.
4. **Worker resource limits:** No discussion of cgroups, CPU limits, or memory limits for ffmpeg containers.
5. **Video format validation:** No check that the uploaded file is actually a valid video before queuing expensive transcoding.
6. **Cross-worker coordination:** With 4 transcode workers, if a video needs sequential formats (1080p before 720p), there's no discussion of job dependencies or parent/child jobs.
7. **Output CDN invalidation:** When a transcode finishes, how does the CDN know to cache the new file?
8. **Job debugging / replay:** No discussion of how to replay a specific job with different parameters for debugging.

---

## EDUCATIONAL QUALITY

### What Works
- The **architecture section** is excellent. The CPU/memory/duration table for job types is exactly the kind of thinking students need.
- **Bug 3 (No Backoff)** and **Bug 1 (No Idempotency)** are perfectly chosen — they map directly to real production incidents.
- The **Saga pattern** introduction (Section 3.7) is well-placed and appropriately scoped.

### What Fails
- **The BullMQ API errors (C1, C2) are catastrophic for learning.** Students will copy the DLQ code, it won't work, and they'll waste hours debugging a syntax error that shouldn't exist in educational material.
- **Bug 5 (Progress Race Condition)** explains the problem well but the "fix" is purely theoretical. The actual worker code in the build guide still writes to a shared `progress` column. Students who build the project will ship the bug they were supposed to learn from.
- **The `setInterval` + `await` anti-pattern** is hidden in the simulation code. This is a classic Node.js footgun that should be called out explicitly.

### Recommendation
**Do not ship this project without:**
1. Fixing the BullMQ `onFailed` constructor option to use `.on('failed', ...)`.
2. Removing the ghost worker in the DLQ example.
3. Replacing `setInterval(async ...)` with a proper async loop.
4. Adding explicit `// SIMULATION ONLY` warnings around `spawn('sh', ...)`.
5. Updating the worker code to actually implement the progress race condition fix (per-job progress in Redis, aggregate on read).

---

*End of Critique P6*
