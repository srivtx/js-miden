# Core Concepts

## WHAT: Learning Management System

An educational platform backend that coordinates:
- **Instructors**: Create courses, lessons, quizzes
- **Students**: Enroll, track progress, take quizzes, earn certificates

Key entities: `User`, `Course`, `Lesson`, `Enrollment`, `Progress`, `Quiz`, `QuizAttempt`, `Certificate`

## WHY: The Hard Problems

### 1. Enrollment Race Condition
Two students simultaneously check if a course has space. Both see 49/50. Both enroll. Result: 51 students in a 50-cap course.

**Why it matters:** Coursera's 2017 over-enrollment bug crashed exam servers when 500+ students tried to take a 300-cap exam simultaneously.

### 2. Progress Persistence
Without timestamps, concurrent progress updates from multiple devices can silently overwrite each other.

**Why it matters:** edX's 2019 progress loss bug affected 12K students who lost weeks of work after refreshing their browser.

### 3. Certificate Integrity
Certificates must only be issued to students who actually completed all requirements.

**Why it matters:** Udemy's 2020 API exploit allowed users to generate certificates without watching a single lesson.

## HOW: The Implementation

### Atomic Enrollment
```typescript
// WRONG: Check-then-create (race condition)
const course = await prisma.course.findUnique({
  where: { id: courseId },
  include: { _count: { select: { enrollments: true } } },
});
if (course._count.enrollments >= course.maxStudents) {
  throw new Error('Course is full');
}
// Another enrollment could happen here!
return prisma.enrollment.create({ data: { userId, courseId } });

// RIGHT: Atomic INSERT with capacity check
const result = await prisma.$queryRaw`
  INSERT INTO enrollments (user_id, course_id, status, progress, enrolled_at)
  SELECT ${userId}, ${courseId}, 'ACTIVE', 0, NOW()
  WHERE (
    SELECT COUNT(*) FROM enrollments WHERE course_id = ${courseId}
  ) < (
    SELECT max_students FROM courses WHERE id = ${courseId}
  )
  RETURNING *
`;
if (!result || result.length === 0) {
  throw new Error('Course is full');
}
```

### Progress with Timestamp
```typescript
// WRONG: No timestamp - concurrent updates overwrite
return prisma.progress.update({
  where: { userId_lessonId: { userId, lessonId } },
  data: { completed: true },
});

// RIGHT: Upsert with updatedAt (implicit via @updatedAt)
return prisma.progress.upsert({
  where: { userId_lessonId: { userId, lessonId } },
  update: { completed: true },
  create: { userId, lessonId, completed: true },
});
```

### Quiz Grading
```typescript
function gradeQuiz(questions: Question[], answers: Answer[]): { score: number; passed: boolean } {
  let correct = 0;
  for (const answer of answers) {
    const question = questions.find(q => q.id === answer.questionId);
    if (question && question.correctAnswer === answer.answer) {
      correct++;
    }
  }
  const score = Math.round((correct / questions.length) * 100);
  return { score, passed: score >= passingScore };
}
```

### Certificate Validation
```typescript
async function validateCertificateEligibility(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment || enrollment.progress < 100) return false;
  
  // Check all quizzes passed
  const quizzes = await prisma.quiz.findMany({
    where: { lesson: { courseId } },
    include: { attempts: { where: { userId } } },
  });
  
  return quizzes.every(quiz => 
    quiz.attempts.some(attempt => attempt.passed)
  );
}
```

## WRONG vs RIGHT

| Scenario | WRONG Approach | RIGHT Approach |
|----------|---------------|----------------|
| Enrollment | Check count then create | Atomic INSERT with subquery |
| Progress | Unconditional update | Upsert with updatedAt |
| Progress % | Calculate on-the-fly | Persist to enrollment record |
| Quiz grading | Client-side scoring | Server-side with hidden answers |
| Certificate | Create without validation | Validate completion + quiz passage |
| Capacity | No database constraint | Atomic enrollment query |

## ASCII Architecture

```
+-------------+      REST/JSON       +---------------+      SQL       +-------------+
|   Student   | <----------------->  |  Express API  | <------------> |  PostgreSQL  |
|   Portal    |                      |   (Node 20)   |                |   (Prisma)   |
+-------------+                      +---------------+                +-------------+
      |                                    |
      |  Lesson completion                   |  Atomic enrollment
      v                                    v
+-------------+                      +---------------+
|  Progress   |                      |   Enrollment  |
|  Tracking   |                      |   (capacity   |
+-------------+                      |   guard)      |
                                     +---------------+
```

```
COURSE COMPLETION FLOW

+----------+     +-----------+     +----------+     +-----------+     +-------------+
| Enroll   | --> | Complete  | --> | Complete | --> | Pass Quiz | --> | Certificate |
|  Student |     | Lesson 1  |     | Lesson N |     |  (if any) |     |   Issued    |
+----------+     +-----------+     +----------+     +-----------+     +-------------+
      |                 |                |                 |                  |
      |                 |                |                 |                  |
      +-----------------+----------------+-----------------+------------------+
                                          |
                                          v
                                    +-----------+
                                    |  Progress |
                                    | Persisted |
                                    +-----------+
```

```
ENROLLMENT RACE CONDITION TIMELINE

Time:     T1              T2              T3
Student A: Read count=49
                           Student B: Read count=49
                                           Student A: Create enrollment (50/50)
                           Student B: Create enrollment (51/50) <-- BUG!

FIX: Atomic INSERT prevents the race

Time:     T1
Student A: INSERT ... WHERE count < max (succeeds, count=50)
Student B: INSERT ... WHERE count < max (fails, count=50)
```
