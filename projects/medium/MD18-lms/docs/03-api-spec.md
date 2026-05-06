# API Specification

## Courses

### GET /api/courses
List all published courses.

### GET /api/courses/:id
Get course details with lessons.

### POST /api/courses
Create a new course.

**Request:**
```json
{
  "title": "Course Title",
  "description": "Course description",
  "instructorId": "uuid",
  "category": "Programming",
  "level": "BEGINNER",
  "maxStudents": 100
}
```

## Enrollments

### POST /api/enrollments
Enroll in a course.

**Request:**
```json
{
  "userId": "uuid",
  "courseId": "uuid"
}
```

### GET /api/enrollments/user/:userId
Get user's enrollments.

## Progress

### POST /api/progress/complete
Mark a lesson as complete.

**Request:**
```json
{
  "userId": "uuid",
  "lessonId": "uuid"
}
```

### GET /api/progress/user/:userId
Get all user progress.

### GET /api/progress/user/:userId/course/:courseId
Get progress for a specific course.

## Quizzes

### GET /api/quizzes/:id
Get quiz details.

### POST /api/quizzes/:id/submit
Submit quiz answers.

**Request:**
```json
{
  "userId": "uuid",
  "answers": [
    { "questionId": "q1", "answer": "A" },
    { "questionId": "q2", "answer": "B" }
  ]
}
```

## Certificates

### POST /api/certificates
Issue a certificate.

**Request:**
```json
{
  "userId": "uuid",
  "courseId": "uuid"
}
```

### GET /api/certificates/user/:userId
Get user's certificates.
