# Bug Report: Progress & Enrollment Race

## Bug 1: Progress Not Persisted

### Severity: HIGH

### Description
When a user marks a lesson as complete and refreshes the page, the progress may be lost or incorrectly calculated because progress updates are not properly persisted and synchronized.

### Root Cause
The `Progress` model lacks an `updatedAt` timestamp, making it impossible to:
1. Detect stale updates
2. Track when progress was last modified
3. Handle concurrent progress updates safely

Additionally, the progress percentage is calculated on-the-fly and never saved to the enrollment record.

```typescript
// Vulnerable code in progressService.ts
async markLessonComplete(userId: string, lessonId: string) {
  const existing = await prisma.progress.findUnique({...});

  if (existing) {
    // BUG: No timestamp check - could overwrite newer data
    return prisma.progress.update({
      where: { userId_lessonId: { userId, lessonId } },
      data: { completed: true },
    });
  }
  // ...
}

// BUG: Progress percentage not persisted
async getCourseProgress(userId: string, courseId: string) {
  // Calculates on-the-fly, never saves to enrollment
  const percentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  return { percentage, ... };
}
```

### Impact
- User progress appears lost after refresh
- Concurrent lesson completions can conflict
- Analytics based on stale data
- Poor user experience

### Fix

**Add updatedAt to Progress model:**
```prisma
model Progress {
  // ... existing fields
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

**Persist progress to enrollment:**
```typescript
async updateEnrollmentProgress(userId: string, courseId: string) {
  const progress = await this.getCourseProgress(userId, courseId);
  
  await prisma.enrollment.updateMany({
    where: { userId, courseId },
    data: { progress: progress.percentage },
  });
}
```

## Bug 2: Enrollment Race Condition

### Severity: HIGH

### Description
Two users can simultaneously enroll in the last available slot of a course, resulting in over-enrollment beyond the course capacity.

### Root Cause
In `EnrollmentService.enroll()`, the capacity check and enrollment creation are not atomic operations.

```typescript
// Vulnerable code in enrollmentService.ts
async enroll(userId: string, courseId: string) {
  // Check current enrollment count
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { _count: { select: { enrollments: true } } },
  });

  // BUG: Race condition - count could change between check and create
  if (course._count.enrollments >= course.maxStudents) {
    throw new Error('Course is full');
  }

  // Another enrollment could happen here!
  return prisma.enrollment.create({...});
}
```

### Impact
- Courses exceed maximum capacity
- Resource strain
- Unfair to students who enrolled properly
- System inconsistency

### Fix Options

**Option 1: Atomic Counter**
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

**Option 2: Pessimistic Locking**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT * FROM courses WHERE id = ${courseId} FOR UPDATE`;
  // Check capacity and create enrollment
});
```

**Option 3: Application-Level Lock**
Use Redis or similar to acquire a lock before checking capacity.
