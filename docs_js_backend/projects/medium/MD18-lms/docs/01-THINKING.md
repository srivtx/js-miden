# Thinking Process: LMS Architecture

## Initial Questions

**Q: Why is enrollment a race condition?**
A: Two students check enrollment count simultaneously, both see 49/50, both enroll. Result: 51/50.

**Q: How do real LMS platforms handle progress tracking?**
A: Canvas LMS uses optimistic locking with version numbers. Moodle uses session-based progress with periodic persistence.

**Q: Should quiz answers be encrypted?**
A: For high-stakes exams, yes. For practice quizzes, plaintext JSON is acceptable. Phase 1 uses JSON.

## Trade-off Analysis

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Atomic raw query** (INSERT with subquery) | Zero race conditions | Raw SQL; less portable | **Phase 1** |
| **Pessimistic locking** (FOR UPDATE) | Guaranteed consistency | Blocks readers | Phase 2 |
| **Optimistic locking** (version column) | No blocking | Retry logic needed | Phase 2 |
| **Queue-based enrollment** | Sequential processing | Adds latency | Phase 3 |

## Progress Tracking Models

**Simple Completion (Binary)**
- Easy to implement
- No conflict detection without timestamp

**Time-Based Tracking**
- Tracks watch percentage for videos
- More accurate but complex

**Adaptive Learning (AI-Driven)**
- Personalized paths based on performance
- Most sophisticated; overkill for Phase 1

## Data Flow Sketch

```
Instructor creates course
    |
    v
Publishes lessons and quizzes
    |
    v
Student browses courses
    |
    v
Student enrolls (ATOMIC CAPACITY CHECK)
    |
    v
Student completes lessons
    |
    v
Progress updated with timestamp
    |
    v
Student takes quiz -> auto-graded
    |
    v
All lessons complete? -> Issue certificate
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Over-enrollment | High | High | Atomic INSERT with subquery |
| Progress overwrite | Medium | High | Add updatedAt + conflict detection |
| Quiz answer leak | Low | Medium | No encryption in Phase 1 |
| Certificate fraud | Low | High | Validate completion before issue |
| Deadlock in transaction | Low | High | Short transactions, proper ordering |
