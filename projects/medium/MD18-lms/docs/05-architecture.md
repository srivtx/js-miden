# Architecture Guide

## System Components

### API Layer (Express 5)

REST API with middleware for authentication, validation, error handling, and logging.

### Service Layer

- `CourseService` - Course and lesson management
- `EnrollmentService` - Student enrollment with capacity management
- `ProgressService` - Lesson completion tracking
- `QuizService` - Quiz delivery and grading
- `CertificateService` - Certificate generation and validation

### Data Access Layer (Prisma)

Type-safe database access with connection pooling and query optimization.

## Enrollment Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Student │────▶│  Check   │────▶│  Create  │
│ Enrolls  │     │ Capacity │     │ Enrollment│
└──────────┘     └──────────┘     └──────────┘
```

## Progress Tracking

1. Student completes a lesson
2. Progress record created/updated
3. Course progress percentage calculated
4. If all lessons complete, mark enrollment as completed
5. Issue certificate if applicable

## Quiz System

1. Quiz associated with lesson
2. Questions stored as JSON
3. Automatic grading on submission
4. Passing score configurable per quiz
5. Multiple attempts allowed

## Scalability Considerations

- **Read Replicas**: For course browsing
- **Caching**: Popular courses and content
- **CDN**: Video content delivery
- **Partitioning**: Progress data by course
