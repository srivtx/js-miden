# Database Schema

## Entity Relationship Diagram

```
┌─────────┐     ┌─────────────┐     ┌──────────┐
│  User   │────▶│ Enrollment  │◀────│  Course  │
└─────────┘     └─────────────┘     └──────────┘
     │                                    │
     │         ┌──────────┐              │
     └────────▶│ Progress │              │
               └──────────┘              │
                    │                     │
                    ▼                     ▼
               ┌──────────┐         ┌──────────┐
               │  Lesson  │◀────────│  Quiz    │
               └──────────┘         └──────────┘
                                          │
                                          ▼
                                    ┌──────────┐
                                    │ Attempt  │
                                    └──────────┘
```

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| email | String | Unique |
| password | String | |
| name | String | |
| role | Enum | STUDENT, INSTRUCTOR, ADMIN |

### courses
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | String | |
| description | String | Nullable |
| instructor_id | UUID | FK → users |
| category | String | |
| level | String | |
| duration | Int | Default 0 |
| max_students | Int | Default 50 |
| is_published | Boolean | Default false |

### lessons
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| course_id | UUID | FK → courses |
| title | String | |
| description | String | Nullable |
| content | String | Nullable |
| video_url | String | Nullable |
| duration | Int | Default 0 |
| order | Int | Default 0 |
| is_published | Boolean | Default false |

### enrollments
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| course_id | UUID | FK → courses |
| status | Enum | ACTIVE, COMPLETED, DROPPED |
| progress | Float | Default 0 |
| enrolled_at | Timestamp | |
| completed_at | Timestamp | Nullable |

### progress
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| lesson_id | UUID | FK → lessons |
| completed | Boolean | Default false |

### quizzes
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| lesson_id | UUID | FK → lessons |
| title | String | |
| questions | Json | |
| passing_score | Int | Default 70 |

### quiz_attempts
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| quiz_id | UUID | FK → quizzes |
| user_id | UUID | FK → users |
| score | Int | |
| answers | Json | |
| passed | Boolean | |

### certificates
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| course_id | UUID | FK → courses |
| issued_at | Timestamp | |

## Indexes

- `enrollments_user_course_idx` unique on (user_id, course_id)
- `progress_user_lesson_idx` unique on (user_id, lesson_id)
- `certificates_user_course_idx` unique on (user_id, course_id)
