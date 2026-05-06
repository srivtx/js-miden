# Decisions & Alternatives

## Decision 1: Enrollment Atomicity

**Chosen: Raw SQL atomic INSERT with capacity subquery**

```typescript
const result = await prisma.$queryRaw`
  INSERT INTO enrollments (user_id, course_id)
  SELECT ${userId}, ${courseId}
  WHERE (
    SELECT COUNT(*) FROM enrollments WHERE course_id = ${courseId}
  ) < (
    SELECT max_students FROM courses WHERE id = ${courseId}
  )
  RETURNING *
`;
```

**Why:** Single atomic operation; no race condition possible. No additional infrastructure.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Pessimistic locking (FOR UPDATE) | Blocks readers; deadlock risk |
| Optimistic locking (version) | Requires retry; more complex |
| Redis counter | Counter drift if Redis and DB inconsistent |
| Application-level semaphore | Doesn't work across multiple server instances |

**Trade-off:** Raw SQL is less portable. But Prisma's `$queryRaw` provides type safety for the result.

---

## Decision 2: Progress Timestamp

**Chosen: Add `updatedAt` to Progress model for conflict detection**

```prisma
model Progress {
  id        String   @id @default(uuid())
  userId    String
  lessonId  String
  completed Boolean  @default(false)
  updatedAt DateTime @updatedAt // NEW: Conflict detection
  
  @@unique([userId, lessonId])
}
```

**Why:** Enables stale update detection. If two tabs update the same lesson, the second update can be rejected if it's based on old data.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| No timestamp (current buggy code) | Concurrent updates silently overwrite |
| Version number (integer) | More explicit but requires client to send version |
| Last-write-wins | Acceptable for LMS but loses intermediate state |

**Trade-off:** `updatedAt` is implicit; version number is more explicit for optimistic locking.

---

## Decision 3: Quiz Storage Format

**Chosen: JSON column for questions and answers**

```typescript
// Quiz questions stored as JSON
{
  "questions": [
    {
      "id": "q1",
      "question": "What is 2+2?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": "B"
    }
  ]
}
```

**Why:** Flexible schema; no migration needed for new question types.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Normalized tables (questions, options, answers) | Rigid schema; many joins |
| Encrypted storage | Overkill for practice quizzes |
| External quiz service (QTI) | Adds dependency; complex standard |

**Trade-off:** JSON doesn't enforce schema at database level. Application must validate structure.

---

## Decision 4: Certificate Issuance

**Chosen: Issue certificate when all lessons are completed AND quiz is passed**

```typescript
async issueCertificate(userId: string, courseId: string) {
  const progress = await this.getCourseProgress(userId, courseId);
  if (progress.percentage < 100) {
    throw new Error('Course not complete');
  }
  
  // Check if certificate already exists
  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) throw new Error('Certificate already issued');
  
  return prisma.certificate.create({
    data: { userId, courseId },
  });
}
```

**Why:** Prevents duplicate certificates and ensures completion validation.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Auto-issue on progress 100% | Race condition if progress and certificate not atomic |
| Manual instructor approval | Adds friction; not scalable |
| Blockchain certificate | Overkill for Phase 1 |

**Trade-off:** No blockchain verification; certificates are database records.

---

## Decision 5: Progress Percentage Persistence

**Chosen: Update enrollment.progress after each lesson completion**

```typescript
async markLessonComplete(userId: string, lessonId: string) {
  // Update progress
  await prisma.progress.upsert({...});
  
  // Recalculate and persist percentage
  const courseProgress = await this.getCourseProgress(userId, courseId);
  await prisma.enrollment.updateMany({
    where: { userId, courseId },
    data: { progress: courseProgress.percentage },
  });
}
```

**Why:** Enrollment table becomes source of truth for progress queries (faster than calculating on-the-fly).

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Calculate on-the-fly (current buggy code) | Slow for analytics; inconsistent |
| Materialized view | Overkill; adds refresh complexity |
| Event-driven async update | Eventual consistency; stale reads |

**Trade-off:** Write amplification: every lesson completion writes to both Progress and Enrollment tables.
