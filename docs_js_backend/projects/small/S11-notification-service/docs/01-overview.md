# S11 Notification Service — Overview

## Project Goal
Build an in-app notification system that creates notifications, lists them with pagination, marks them as read, and pushes real-time unread counts via Server-Sent Events (SSE).

## Key Features
- **Create notifications**: `POST /notify` stores a notification and increments the user's unread count.
- **Paginated listing**: `GET /notifications` returns notifications ordered by recency with offset pagination.
- **Mark read**: `PATCH /notifications/:id/read` sets `read=1` and decrements the unread counter.
- **Real-time SSE**: `GET /notifications/stream` pushes unread count updates to connected clients.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: SQLite (`better-sqlite3`)
- **Real-time**: Server-Sent Events (SSE)
- **Language**: TypeScript (ESM)

## High-Level Architecture

```
┌──────────────┐   POST /notify    ┌──────────────┐   SQL    ┌──────────┐
│   Client     │ ────────────────► │   Express    │ ──────── │  SQLite  │
│  (curl/test) │                   │ notifications│          │          │
│              │ ◄──────────────── │   Router     │          │  users   │
└──────────────┘   SSE stream      └──────────────┘          └──────────┘
```

## Entry Points
- `src/index.ts` — Server bootstrap.
- `src/app.ts` — Express app setup.
- `src/notifications.ts` — Core notification routes.
- `src/sse.ts` — SSE client registry and broadcast helper.
- `src/db.ts` — SQLite schema.
- `tests/notifications.test.ts` — Test suite.

## Scope & Limitations
This project intentionally contains a **race condition** in the unread count updater (read-modify-write pattern). Under concurrent load, two simultaneous requests can read the same count, decrement in memory, and both write the same new value, losing an update.
