# S09: Polling API

## Overview
A real-time polling API where users can create polls, vote on options, and see live result updates via Server-Sent Events (SSE).

## Thinking Framework

### PHASE 1: Core Features
- Create a poll with a question and multiple options.
- Vote on an option.
- Retrieve current results.
- Stream results in real-time using SSE.

### PHASE 2: Design Decisions
- **Vote Deduplication**: The simplest approach is IP-based tracking. For production, use authenticated users or fingerprinting (cookie + IP + User-Agent hashing) to reduce fraud.
- **Real-Time Updates**: SSE is lightweight and works over standard HTTP. For very high fan-out, consider WebSockets or a pub/sub system (Redis, Kafka).
- **Preventing Over-Voting**: Rate limiting per IP and CAPTCHA can reduce automated abuse.
- **Aggregate Results**: Computing aggregates on read is fine for small polls. For large-scale polls, maintain counters and use atomic increments.

### PHASE 3: Bugs & Hardening
This project intentionally contains bugs to test awareness:

1. **Race Condition in Vote Counting**: The vote handler reads the current count, increments it in JavaScript, and writes it back. Under concurrent requests, two reads can see the same value, causing lost updates (lost votes).
2. **IP Spoofing**: A determined user can bypass the IP check by rotating `X-Forwarded-For` headers. The current implementation only checks `req.ip`.
3. **SSE Connection Leaks**: While a basic `req.on('close')` handler exists, in some disconnect scenarios ( abrupt TCP drops) the cleanup may be missed, leaking intervals and keeping connections open.

## Project Structure
```
src/
  db.ts        - SQLite in-memory database (polls, options, votes tables)
  polls.ts     - Route handlers with non-atomic vote increment
  app.ts       - Express application composition
  index.ts     - Server entry point
tests/
  polls.test.ts - Vitest tests for CRUD, duplicate votes, and race condition awareness
```

## Running
```bash
npm install
npm run dev     # tsx src/index.ts
npm test        # vitest run
```

## Example Requests
```bash
# Create poll
curl -X POST http://localhost:3000/polls \
  -H "Content-Type: application/json" \
  -d '{"question":"Best language?","options":["TS","Rust","Go"]}'

# Vote
curl -X POST http://localhost:3000/polls/1/vote \
  -H "Content-Type: application/json" \
  -d '{"option_id":1}'

# SSE stream
curl http://localhost:3000/polls/1/stream
```
