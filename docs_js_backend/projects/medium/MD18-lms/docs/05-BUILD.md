# Build Guide: Step-by-Step

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)

## Step 1: Project Setup

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/medium/MD18-lms
npm install
cp .env.example .env
# Edit DATABASE_URL
```

## Step 2: Database Setup

```bash
docker-compose up -d db
npx prisma migrate dev
npm run db:seed
```

## Step 3: Schema Overview

```prisma
model Course {
  id          String   @id @default(uuid())
  title       String
  description String?
  instructorId String
  category    String
  level       String   @default("BEGINNER")
  duration    Int      @default(0)
  maxStudents Int      @default(50)
  isPublished Boolean  @default(false)
  lessons     Lesson[]
  enrollments Enrollment[]
  certificates Certificate[]
}

model Enrollment {
  id          String   @id @default(uuid())
  userId      String
  courseId    String
  status      EnrollmentStatus @default(ACTIVE)
  progress    Float    @default(0)
  enrolledAt  DateTime @default(now())
  completedAt DateTime?
  
  @@unique([userId, courseId])
}

model Progress {
  id        String   @id @default(uuid())
  userId    String
  lessonId  String
  completed Boolean  @default(false)
  updatedAt DateTime @updatedAt // Conflict detection
  
  @@unique([userId, lessonId])
}
```

## Step 4: Implement Enrollment Service

```typescript
// src/services/enrollmentService.ts
import { prisma } from '../utils/prisma.js';

export class EnrollmentService {
  async enroll(userId: string, courseId: string) {
    // Check existing enrollment
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new Error('Already enrolled');

    // ATOMIC: Insert only if capacity not reached
    const result = await prisma.$queryRaw<Enrollment[]>`
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

    return result[0];
  }

  async getUserEnrollments(userId: string) {
    return prisma.enrollment.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
```

## Step 5: Implement Progress Service

```typescript
// src/services/progressService.ts
import { prisma } from '../utils/prisma.js';

export class ProgressService {
  async markLessonComplete(userId: string, lessonId: string) {
    // Upsert progress with timestamp
    await prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { completed: true },
      create: { userId, lessonId, completed: true },
    });

    // Get lesson's course
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { courseId: true },
    });

    if (lesson) {
      // Recalculate and persist progress
      const courseProgress = await this.getCourseProgress(userId, lesson.courseId);
      await prisma.enrollment.updateMany({
        where: { userId, courseId: lesson.courseId },
        data: { progress: courseProgress.percentage },
      });
    }

    return this.getUserProgress(userId);
  }

  async getCourseProgress(userId: string, courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { lessons: true },
    });
    if (!course) throw new Error('Course not found');

    const progress = await prisma.progress.findMany({
      where: { userId, lesson: { courseId } },
    });

    const completedLessons = progress.filter(p => p.completed).length;
    const totalLessons = course.lessons.length;
    const percentage = totalLessons > 0 
      ? Math.round((completedLessons / totalLessons) * 100) 
      : 0;

    return { courseId, completedLessons, totalLessons, percentage };
  }
}
```

## Step 6: Implement Quiz Service

```typescript
// src/services/quizService.ts
interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

interface Answer {
  questionId: string;
  answer: string;
}

export class QuizService {
  async submitQuiz(userId: string, quizId: string, answers: Answer[]) {
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new Error('Quiz not found');

    const questions = quiz.questions as Question[];
    
    // Grade server-side
    let correct = 0;
    for (const answer of answers) {
      const question = questions.find(q => q.id === answer.questionId);
      if (question && question.correctAnswer === answer.answer) {
        correct++;
      }
    }

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= quiz.passingScore;

    // Store attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        score,
        answers: answers as any,
        passed,
      },
    });

    return { score, passed, attempt };
  }
}
```

## Step 7: Implement Certificate Service

```typescript
// src/services/certificateService.ts
export class CertificateService {
  async issueCertificate(userId: string, courseId: string) {
    // Validate completion
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.progress < 100) {
      throw new Error('Course not completed');
    }

    // Check quizzes passed
    const quizzes = await prisma.quiz.findMany({
      where: { lesson: { courseId } },
      include: { attempts: { where: { userId } } },
    });
    const allPassed = quizzes.every(quiz => 
      quiz.attempts.some(a => a.passed)
    );
    if (!allPassed) {
      throw new Error('Not all quizzes passed');
    }

    // Prevent duplicate
    const existing = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new Error('Certificate already issued');

    return prisma.certificate.create({
      data: { userId, courseId },
      include: { course: true, user: true },
    });
  }
}
```

## Step 8: Run Tests

```bash
npm test
npm test -- --coverage
```

## Step 9: Start Server

```bash
npm run dev
```

API at `http://localhost:3002`

## Step 10: Verify

```bash
# Enroll in course
curl -X POST http://localhost:3002/api/enrollments \
  -H "Content-Type: application/json" \
  -d '{"userId": "uuid", "courseId": "uuid"}'

# Mark lesson complete
curl -X POST http://localhost:3002/api/progress/complete \
  -H "Content-Type: application/json" \
  -d '{"userId": "uuid", "lessonId": "uuid"}'

# Submit quiz
curl -X POST http://localhost:3002/api/quizzes/:id/submit \
  -H "Content-Type: application/json" \
  -d '{"userId": "uuid", "answers": [{"questionId": "q1", "answer": "B"}]}'

# Issue certificate
curl -X POST http://localhost:3002/api/certificates \
  -H "Content-Type: application/json" \
  -d '{"userId": "uuid", "courseId": "uuid"}'
```
