# Critique & Limitations

## What's Good

1. **Atomic enrollment** via raw SQL prevents over-enrollment
2. **Progress timestamp** (`updatedAt`) enables conflict detection
3. **Server-side quiz grading** prevents client-side cheating
4. **Certificate validation** ensures completion before issuance
5. **Prisma type safety** prevents schema mismatches

## What's Missing / Limitations

### 1. No Optimistic Locking
**Problem:** `updatedAt` detects conflicts but doesn't prevent them. Two concurrent updates to the same progress record will both succeed (last-write-wins).

**Real-world standard:** Version numbers with conditional updates (`WHERE version = expected`).

**Impact:** Rare data loss in concurrent multi-device usage.

### 2. No Video Streaming
**Problem:** Video URLs are stored as plain strings. No HLS/DASH streaming, no adaptive bitrate.

**Real-world standard:** AWS CloudFront with HLS segments; CDN edge caching.

**Impact:** Poor playback experience on slow connections; high bandwidth costs.

### 3. No Spaced Repetition
**Problem:** Quiz system doesn't adapt to student performance. Weak concepts aren't revisited.

**Real-world standard:** SuperMemo-2 algorithm or SM-17 for optimal review scheduling.

**Impact:** Lower knowledge retention rates.

### 4. No Offline Support
**Problem:** Progress only tracks when online. No sync queue for offline lesson completion.

**Real-world standard:** Service Workers with background sync; offline-first architecture.

**Impact:** Students with intermittent connectivity lose progress.

### 5. No Analytics Pipeline
**Problem:** No aggregation of learning metrics (completion rates, time-on-task, dropout prediction).

**Real-world standard:** xAPI event stream to data warehouse; Tableau/Looker dashboards.

**Impact:** Instructors can't identify at-risk students.

### 6. No Content Versioning
**Problem:** Updating a lesson overwrites previous content. Students who started with old content see inconsistencies.

**Real-world standard:** Immutable content versions; students pinned to version they enrolled with.

## Architecture Debt

| Debt Item | Severity | Fix Effort |
|-----------|----------|------------|
| No optimistic locking | Medium | Low |
| No video streaming | High | High |
| No spaced repetition | Medium | High |
| No offline support | Medium | High |
| No analytics pipeline | Medium | Medium |
| No content versioning | Low | Medium |
| No A/B testing framework | Low | Medium |

## Testing Gaps

1. No load tests for 1000+ concurrent enrollments
2. No chaos tests for database connection failures during enrollment
3. No property-based tests for quiz grading edge cases
4. No integration tests for progress sync across devices
5. No accessibility tests (WCAG compliance)

## Performance Benchmarks (Projected)

| Metric | Current | Target (Phase 2) |
|--------|---------|------------------|
| Enrollment | ~30ms | ~20ms (with Redis counter) |
| Progress update | ~25ms | ~15ms |
| Quiz grading | ~10ms | ~10ms (unchanged) |
| Course listing | ~40ms | ~15ms (with read replica) |
| Certificate generation | ~50ms | ~30ms |

## Recommended Phase 2 Roadmap

1. Add Redis for caching + atomic counters
2. Implement HLS video streaming with CDN
3. Add spaced repetition algorithm (SM-2)
4. Build offline-first sync architecture (Service Workers)
5. Add analytics pipeline (xAPI + ClickHouse)
6. Implement content versioning system
7. Add A/B testing for course structures
8. Integrate LLM-powered tutoring assistant
