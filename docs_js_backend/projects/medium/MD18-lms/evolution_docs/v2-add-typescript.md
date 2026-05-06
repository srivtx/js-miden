# MD18 LMS — v2 Add TypeScript

## Goal
Add type safety to course, enrollment, and progress data.

## Changes from v1
- Rename `.js` → `.ts`
- Add `tsconfig.json`
- Define interfaces for Course, Enrollment, Lesson, Quiz

## New Interfaces

### `src/types/index.ts`
```typescript
export interface CourseInput {
  title: string;
  description?: string;
  instructorId: string;
  maxStudents: number;
}

export interface EnrollmentInput {
  userId: string;
  courseId: string;
}

export interface LessonInput {
  courseId: string;
  title: string;
  content: string;
  sequence: number;
}

export interface QuizInput {
  lessonId: string;
  questions: { question: string; options: string[]; correctIndex: number }[];
}
```

## Updated Service

### `src/services/enrollmentService.ts`
```typescript
import { db } from '../db.js';
import type { EnrollmentInput } from '../types/index.js';

export class EnrollmentService {
  async enroll(data: EnrollmentInput) {
    const { userId, courseId } = data;
    // TypeScript guarantees strings, but still no capacity logic
    // ...
  }
}
```

## Benefits
- `maxStudents` typo caught at compile time
- Refactoring `courseId` to `courseID` is safe
- Autocomplete for lesson sequences

## Still Missing
- No validation on HTTP payloads
- No tests for capacity limits
