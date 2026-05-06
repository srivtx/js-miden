# MD18: Learning Management System (LMS)

## What Problem Does This Solve?

Learning Management Systems must coordinate course content, student enrollments, progress tracking, assessments, and certification—while preventing race conditions in enrollment caps, ensuring progress persistence, and maintaining data consistency across concurrent users.

## The Core Problem

Build a backend system that:
1. Lets instructors create courses with lessons and quizzes
2. Lets students enroll in courses with capacity limits
3. Tracks lesson completion and course progress
4. Automatically grades quizzes
5. Issues certificates upon completion
6. Prevents over-enrollment (race condition on capacity)
7. Ensures progress updates are persisted and conflict-safe

## Real-World Stakes

| Incident | Platform | Impact |
|----------|----------|--------|
| Over-enrollment bug | Coursera (2017) | 500+ students enrolled in 300-cap course; server crashes during exams |
| Progress loss | edX (2019) | Students lost weeks of progress after refresh; 12K support tickets |
| Quiz grading error | Khan Academy (2018) | Wrong answers marked correct; 50K+ students affected |
| Certificate fraud | Udemy (2020) | API exploit allowed certificate generation without completion |

## Constraints

- PostgreSQL as single source of truth
- Express 5 + TypeScript (ESM)
- No external video streaming service (mock URLs)
- Must handle concurrent enrollment during course launches

## Success Criteria

- [ ] Enrollment respects capacity limits (atomic counter)
- [ ] Progress has timestamp for conflict detection
- [ ] Quiz grading is deterministic
- [ ] Certificates only issued for completed courses
- [ ] Course progress percentage is persisted
