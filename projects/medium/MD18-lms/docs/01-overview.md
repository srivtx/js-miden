# MD18: Learning Management System

## Overview

A comprehensive Learning Management System enabling course creation, lesson delivery, progress tracking, quizzes, and certificate issuance.

## Features

- **Course Management**: Create and manage courses with lessons
- **Lesson Delivery**: Structured content delivery with video support (mock)
- **Progress Tracking**: Track student progress through courses
- **Quizzes**: Assessments with automatic grading
- **Certificates**: Issued upon course completion
- **Enrollment System**: Student enrollment with capacity limits
- **Analytics**: Course completion rates and student performance

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Student   │────▶│   Express    │────▶│   Prisma    │
│   Portal    │◀────│   API (5)    │◀────│  (Postgres) │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Tech Stack

- **Backend**: Express 5, TypeScript (ESM)
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Vitest + Supertest
- **Deployment**: Docker Compose

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start database
docker-compose up -d db

# Run migrations
npx prisma migrate dev

# Seed data
npm run db:seed

# Start development
npm run dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/courses` | GET | List all courses |
| `/api/courses/:id` | GET | Get course details |
| `/api/courses/:id/lessons` | GET | Get course lessons |
| `/api/enrollments` | POST | Enroll in course |
| `/api/progress/complete` | POST | Mark lesson complete |
| `/api/progress/user/:id` | GET | Get user progress |
| `/api/quizzes/:id` | GET | Get quiz details |
| `/api/quizzes/:id/submit` | POST | Submit quiz answers |
| `/api/certificates` | POST | Issue certificate |

## Known Issues

See `docs/06-bug-report.md` for detailed bug documentation.
