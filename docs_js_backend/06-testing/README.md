# Module 06: Testing - From "It Works on My Machine" to Production Confidence

> **"Untested code is broken code. It just hasn't broken yet."**

Testing is not a luxury. It's not something you do "if there's time." Testing is the difference between a $440 million disaster and a peaceful night's sleep. In this module, we build a testing culture—from fast unit tests to production-grade integration suites.

---

## Table of Contents

1. [Why Testing Matters](#why-testing-matters)
2. [The Testing Pyramid](#the-testing-pyramid)
3. [Setting Up Vitest](#setting-up-vitest)
4. [Unit Testing Business Logic](#unit-testing-business-logic)
5. [Integration Testing with Supertest](#integration-testing-with-supertest)
6. [Mocking Strategies](#mocking-strategies)
7. [API Contract Testing](#api-contract-testing)
8. [Load Testing with k6](#load-testing-with-k6)
9. [What Happens When You Test Wrong](#what-happens-when-you-test-wrong)
10. [CI/CD Integration](#cicd-integration)
11. [Mini Project: Test Suite for Task Management API](#mini-project-test-suite-for-task-management-api)

---

## Why Testing Matters

### WHAT Is the Purpose of Testing?

Testing is not about finding bugs. It's about **providing confidence** that your system behaves correctly under known and edge conditions. A good test suite:

- Catches regressions before they reach production
- Documents expected behavior better than prose
- Enables fearless refactoring
- Validates integration points between components
- Verifies performance under load

### WHY Is Testing Non-Negotiable?

**The Knight Capital Story (August 1, 2012)**

Knight Capital was a major US market maker. On August 1, 2012, they deployed new trading software to production. The software contained a critical defect: a repurposed flag activated obsolete test code.

In **45 minutes**:
- The system sent **4 million erroneous orders**
- It bought high and sold low (the opposite of market making)
- Knight Capital lost **$440 million**
- The company's stock price dropped **75%**
- They were acquired within 6 months to avoid bankruptcy

**Root cause:** The deployment included untested code paths. A dead testing harness was accidentally activated in production because no integration test verified the deployment artifact.

**Cost of not testing:** $440 million, 6 months, and the company's independence.

### WHAT HAPPENS If You Don't Test?

- **Production crashes**: Simple logic errors reach users. A missing `await` causes race conditions. A typo in a SQL query returns wrong data.
- **Fear-based development**: Developers become afraid to touch code. "If it works, don't touch it" becomes the culture. Technical debt compounds.
- **Late-night pages**: Bugs found by users are more expensive to fix. A bug caught in development costs $100. In production, it costs $10,000+.
- **Reputational damage**: Every outage is a tweet. Every data leak is a headline.
- **Slower releases**: Without tests, releases require manual QA cycles. Teams deploy once a month instead of multiple times a day.

### The Economics of Testing

| Phase Bug Found | Relative Cost | Impact |
|-----------------|---------------|--------|
| Development | 1x | Developer fixes immediately |
| Code review | 2x | Another developer spots it |
| CI/Test | 5x | Test fails, developer context-switches back |
| Staging | 10x | QA finds it, ticket created, prioritized |
| Production | 100x+ | Incident response, customer impact, hotfix, retro |

**Testing is the cheapest insurance policy you can buy.**

---

## The Testing Pyramid

### WHAT Is the Testing Pyramid?

The testing pyramid organizes tests into three tiers by scope, speed, and cost:

```
        /\
       /  \     E2E Tests (10%)
      /    \    Minutes | Full system | High cost
     /------\
    /        \   Integration Tests (20%)
   /          \  Seconds | Module + DB | Medium cost
  /------------\
 /              \ Unit Tests (70%)
/                \ Milliseconds | Function | Low cost
```

| Layer | Proportion | Speed | Scope | Cost |
|-------|-----------|-------|-------|------|
| **Unit Tests** | 70% | Milliseconds | Single function/class | Low |
| **Integration Tests** | 20% | Seconds | Module + DB + external deps | Medium |
| **E2E Tests** | 10% | Minutes | Full HTTP request/response | High |

### WHY These Proportions?

**Unit tests are cheap and fast.** A team can run 500 unit tests in under 5 seconds. They provide precise failure locations and don't require infrastructure.

**Integration tests catch wiring bugs.** Unit tests cannot catch SQL syntax errors, connection pool exhaustion, ORM misconfigurations, or transaction isolation issues.

**E2E tests validate user value but are expensive.** They require the full application stack, are slow, and fail for many reasons (network, timing, external services), making root cause analysis harder.

### WHAT HAPPENS If You Ignore the Pyramid?

- **Too few unit tests:** Teams spend hours debugging integration test failures that are simple logic errors. Test suites take 20+ minutes to run, killing developer feedback loops.
- **Too few integration tests:** "Works on my machine" syndrome. Code passes unit tests but fails in staging due to database behavior differences. The infamous "it worked in SQLite but broke in Postgres" bug.
- **Too many E2E tests:** Flaky test suites that fail randomly. Developers stop trusting CI results. Releases get delayed because "the tests are red again but nobody knows why."

### Real Bugs Caught at Each Level

- **Unit level:** Authentication middleware incorrectly decoding JWT payload structure; validation logic allowing XSS payloads through regex; rate limiter algorithm miscalculating window boundaries.
- **Integration level:** Prisma migration drift causing `NULL` constraint failures; connection pool saturation under concurrent requests; Redis cache invalidation race conditions; TypeORM lazy loading N+1 queries.
- **E2E level:** CORS misconfiguration blocking preflight requests; middleware ordering causing authentication to run after logging; API gateway timeout truncating large payloads.

---

## Setting Up Vitest

### WHAT Is Vitest?

Vitest is a test runner built on top of Vite, designed as a Jest-compatible alternative with native ESM and TypeScript support.

### WHY Vitest Over Jest in 2025?

| Feature | Jest | Vitest |
|---------|------|--------|
| Startup speed | Slow (Babel transform) | Fast (esbuild) |
| ESM support | Problematic | Native |
| Vite integration | Separate pipeline | Unified config |
| Watch mode | Memory leaks reported | HMR-powered, instant |
| TypeScript | Requires config | Zero-config |
| UI | None built-in | Built-in visual explorer |

**Key advantages:**
- **Unified pipeline:** Uses the same `vite.config.js` for dev, build, and test
- **Native ESM:** First-class ES Module support as the ecosystem moves away from CommonJS
- **Speed:** Leverages Vite's instant HMR for watch mode. Tests rerun in milliseconds
- **Jest-compatible API:** `describe`, `it`, `expect`, `vi.fn()` are nearly drop-in replacements

### WHAT HAPPENS If You Stick with Jest Unnecessarily?

- **Slow CI pipelines:** Jest's Babel transformation adds 30-60 seconds to test startup on large codebases
- **Memory leaks in watch mode:** Developers restart the test runner repeatedly, losing flow state
- **ESM friction:** Hours spent configuring `transformIgnorePatterns` and `extensionsToTreatAsEsm`
- **Duplicate tooling:** Maintaining both Vite and Jest configurations

### Installation and Configuration

```bash
npm install -D vitest supertest @types/supertest
# Optional: for testcontainers
npm install -D @testcontainers/postgresql
```

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,           // Use describe/it/expect without imports
    environment: 'node',     // Node.js environment
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    setupFiles: ['./test/setup.js'],  // Global test setup
  },
});
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Your First Vitest Test

```javascript
// src/utils/slugify.js
export function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

// src/utils/slugify.test.js
import { describe, it, expect } from 'vitest';
import { slugify } from './slugify.js';

describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('handles accents', () => {
    expect(slugify('café')).toBe('cafe');
  });

  it('removes special characters', () => {
    expect(slugify('hello@world!')).toBe('helloworld');
  });

  it('handles multiple spaces', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });
});
```

Run it:
```bash
npx vitest
```

---

## Unit Testing Business Logic

### WHAT Is a Unit Test?

A unit test verifies a single unit of work in isolation. A "unit" is typically a function, method, or class. Unit tests:
- Run in milliseconds
- Don't touch the network, filesystem, or database
- Use test doubles (mocks, fakes, stubs) for dependencies

### WHY Extract Business Logic from Routes?

**Bad: Business logic in route handler (impossible to unit test)**

```javascript
app.post('/api/v1/orders', async (req, res) => {
  const user = await db.user.findById(req.user.id);
  if (user.credits < req.body.amount) {
    return res.status(400).json({ error: 'Insufficient credits' });
  }
  if (req.body.amount > 10000) {
    return res.status(400).json({ error: 'Amount too large' });
  }
  const order = await db.order.create({
    userId: req.user.id,
    amount: req.body.amount,
    status: 'pending',
  });
  await db.user.update({
    where: { id: req.user.id },
    data: { credits: { decrement: req.body.amount } },
  });
  res.json(order);
});
```

To test this, you must:
1. Start an HTTP server
2. Set up a real database
3. Create a user with credits
4. Send an HTTP request
5. Parse the response

That's an integration test, not a unit test. And it's slow.

**Good: Thin handler, testable service**

```javascript
// src/services/order.service.js
export class InsufficientCreditsError extends Error {}
export class AmountTooLargeError extends Error {}

export class OrderService {
  constructor({ userRepository, orderRepository }) {
    this.userRepository = userRepository;
    this.orderRepository = orderRepository;
  }

  async createOrder(userId, amount) {
    if (amount > 10000) {
      throw new AmountTooLargeError('Amount exceeds maximum of 10000');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.credits < amount) {
      throw new InsufficientCreditsError(
        `Required: ${amount}, Available: ${user.credits}`
      );
    }

    const order = await this.orderRepository.create({
      userId,
      amount,
      status: 'pending',
    });

    await this.userRepository.updateCredits(userId, -amount);
    return order;
  }
}

// src/services/order.service.test.js
import { describe, it, expect, vi } from 'vitest';
import { OrderService, InsufficientCreditsError, AmountTooLargeError } from './order.service.js';

describe('OrderService', () => {
  const createService = (overrides = {}) => {
    return new OrderService({
      userRepository: {
        findById: vi.fn(),
        updateCredits: vi.fn(),
        ...overrides.userRepository,
      },
      orderRepository: {
        create: vi.fn(),
        ...overrides.orderRepository,
      },
    });
  };

  it('creates an order when user has sufficient credits', async () => {
    const service = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ id: 'user-1', credits: 500 }),
        updateCredits: vi.fn().mockResolvedValue(undefined),
      },
      orderRepository: {
        create: vi.fn().mockResolvedValue({ id: 'order-1', amount: 100 }),
      },
    });

    const order = await service.createOrder('user-1', 100);

    expect(order.id).toBe('order-1');
    expect(service.userRepository.updateCredits).toHaveBeenCalledWith('user-1', -100);
  });

  it('throws InsufficientCreditsError when balance is too low', async () => {
    const service = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ id: 'user-1', credits: 50 }),
      },
    });

    await expect(service.createOrder('user-1', 100))
      .rejects.toThrow(InsufficientCreditsError);
  });

  it('throws AmountTooLargeError for amounts over 10000', async () => {
    const service = createService();

    await expect(service.createOrder('user-1', 15000))
      .rejects.toThrow(AmountTooLargeError);
  });

  it('does not deduct credits if order creation fails', async () => {
    const service = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ id: 'user-1', credits: 500 }),
        updateCredits: vi.fn(),
      },
      orderRepository: {
        create: vi.fn().mockRejectedValue(new Error('DB error')),
      },
    });

    await expect(service.createOrder('user-1', 100)).rejects.toThrow('DB error');
    expect(service.userRepository.updateCredits).not.toHaveBeenCalled();
  });
});
```

### WHY Dependency Injection?

By injecting repositories, we can:
- Test with in-memory fakes (no database needed)
- Run tests in parallel (no shared state)
- Simulate failures (make `create()` reject)
- Verify interactions (was `updateCredits` called?)

### WHAT HAPPENS If You Don't Extract Business Logic?

- **No unit tests possible:** Everything becomes an integration test. Test suites take 10+ minutes.
- **Tight coupling:** You can't change the database without rewriting route handlers.
- **Testing gaps:** Edge cases (insufficient funds, race conditions) are never tested because integration tests are too expensive to write for every scenario.

---

## Integration Testing with Supertest

### WHAT Is Supertest?

Supertest is the de facto standard for HTTP assertions in Node.js. It can bind directly to an Express app without starting a server on a port.

### WHY Supertest?

- Fluent, chainable API
- No port binding required (`request(app).get(...)`)
- Mature, well-documented, massive adoption
- Supports promises, async/await

### WHAT HAPPENS If You Only Test with Real HTTP?

- **Port conflicts:** Tests fail because port 3000 is already in use
- **Slower tests:** TCP handshake + HTTP overhead for every request
- **CI fragility:** Race conditions on port allocation in parallel test runs

### Basic Supertest Pattern

```javascript
// test/app.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /health', () => {
  it('returns health status', async () => {
    const res = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
```

### Test Database Setup: Testcontainers Over SQLite

#### WHAT Is Testcontainers?

Testcontainers is a library that spins up real databases (PostgreSQL, MySQL, MongoDB, Redis) in Docker containers for the duration of your tests.

#### WHY Testcontainers Over SQLite?

SQLite is fast but **dangerously different** from PostgreSQL:

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| JSONB operators | Limited | Rich |
| Array types | No | Yes |
| Full-text search | Basic | Advanced |
| `ILIKE` | No | Yes |
| CTEs | Limited | Full |
| Foreign key behavior | Different | Strict |

**Real bug:** A team used SQLite for tests but PostgreSQL in production. A query used `ILIKE` (Postgres-only). All tests passed. Production deployed and immediately 500'd on every search request.

#### WHAT HAPPENS If You Test with SQLite Only?

- **Dialect surprises:** PostgreSQL-specific queries fail in production despite passing tests
- **Type differences:** `BIGINT` behavior differs; `DATE` vs `TIMESTAMP` issues
- **False confidence:** Your test suite is green while your production database rejects queries

#### Testcontainers Implementation

```javascript
// test/setup.js
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

let container;
let prisma;

export async function setupTestDb() {
  container = await new PostgreSqlContainer().start();
  const databaseUrl = container.getConnectionUri();

  // Run migrations
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  return { container, prisma, databaseUrl };
}

export async function teardownTestDb() {
  await prisma?.$disconnect();
  await container?.stop();
}

// test/tasks.integration.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './setup.js';
import { createApp } from '../src/app.js';

describe('Tasks API (Integration)', () => {
  let app;
  let testDb;

  beforeAll(async () => {
    testDb = await setupTestDb();
    app = createApp(testDb.prisma);
  }, 60000); // 60s timeout for container startup

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.prisma.task.deleteMany();
  });

  it('creates and retrieves a task', async () => {
    const createRes = await request(app)
      .post('/api/v1/tasks')
      .send({ title: 'Test task', priority: 'high' })
      .expect(201);

    expect(createRes.body.title).toBe('Test task');
    expect(createRes.headers.location).toMatch(/\/api\/v1\/tasks\/task-/);

    const getRes = await request(app)
      .get(createRes.headers.location)
      .expect(200);

    expect(getRes.body.title).toBe('Test task');
    expect(getRes.body.status).toBe('todo');
  });

  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .get('/api/v1/tasks/task-nonexistent')
      .expect(404);

    expect(res.body.type).toContain('task-not-found');
  });

  it('validates task input', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .send({ title: '' })
      .expect(422);

    expect(res.body.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('lists tasks with pagination', async () => {
    // Create 5 tasks
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/tasks')
        .send({ title: `Task ${i}` });
    }

    const res = await request(app)
      .get('/api/v1/tasks?limit=2')
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.has_more).toBe(true);
    expect(res.body.pagination.next_cursor).toBeDefined();

    // Fetch next page
    const page2 = await request(app)
      .get(`/api/v1/tasks?limit=2&cursor=${res.body.pagination.next_cursor}`)
      .expect(200);

    expect(page2.body.data).toHaveLength(2);
  });
});
```

### Setup/Teardown Patterns

| Pattern | Use Case | Speed | Isolation |
|---------|----------|-------|-----------|
| **BeforeAll/AfterAll** | One database per test file | Fastest | File-level |
| **BeforeEach/AfterEach** | Clean state between tests | Medium | Test-level |
| **Transaction rollback** | Roll back after each test | Fast | Perfect |

**Transaction rollback pattern:**

```javascript
// Fastest pattern: rollback after each test
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

Note: Prisma doesn't support nested transactions easily. Use raw SQL or a savepoint approach.

### Testing Authenticated Routes

```javascript
// test/auth.helper.js
import jwt from 'jsonwebtoken';

export function generateTestToken(userId, role = 'user') {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// test/tasks.auth.test.js
import { generateTestToken } from './auth.helper.js';

describe('Authenticated routes', () => {
  it('allows access with valid token', async () => {
    const token = generateTestToken('user-1', 'admin');

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Admin task' })
      .expect(201);

    expect(res.body.title).toBe('Admin task');
  });

  it('rejects requests without token', async () => {
    await request(app)
      .post('/api/v1/tasks')
      .send({ title: 'No auth' })
      .expect(401);
  });

  it('rejects requests with expired token', async () => {
    const expiredToken = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET, { expiresIn: '-1h' });

    await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
});
```

---

## Mocking Strategies

### WHAT Are Test Doubles?

| Type | Description | Use Case |
|------|-------------|----------|
| **Dummy** | Object passed but never used | Filling parameter lists |
| **Fake** | Working but simplified implementation | In-memory repository |
| **Stub** | Provides canned answers | Returning fixed user data |
| **Spy** | Records calls for verification | Verify email was sent |
| **Mock** | Pre-programmed with expectations | Verify method called exactly once |

### WHEN to Mock vs. Use Real Dependencies

**Mock when:**
- The dependency is slow (external API, database writes in unit tests)
- The dependency is non-deterministic (random generators, current time)
- The dependency is unavailable in CI (third-party sandbox, payment gateways)
- You want to simulate failure modes (network timeout, 500 error)

**Use real dependencies when:**
- Testing database query logic (testcontainers)
- Testing serialization/deserialization boundaries
- Integration tests where wiring is what you're verifying
- The cost of mocking exceeds the cost of the real thing

### WHAT HAPPENS If You Mock Too Much?

- **False confidence:** Tests pass but production breaks because the mock doesn't match reality
- **Brittle tests:** Every internal refactoring breaks mock expectations
- **Missing integration bugs:** The real service returns unexpected headers or timing

### Vitest Mocking

```javascript
// Mocking a module
vi.mock('../src/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'msg-123' }),
}));

// Mocking a function
const sendEmail = vi.fn();
sendEmail.mockResolvedValue({ sent: true });

// Spying on a method
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Restoring mocks after test
afterEach(() => {
  vi.restoreAllMocks();
});
```

### Fake Repository Pattern

```javascript
// test/fakes/InMemoryTaskRepository.js
export class InMemoryTaskRepository {
  constructor() {
    this.tasks = new Map();
    this.idCounter = 1;
  }

  async create(data) {
    const task = { id: `task-${this.idCounter++}`, ...data };
    this.tasks.set(task.id, task);
    return task;
  }

  async findById(id) {
    return this.tasks.get(id) || null;
  }

  async findMany({ where, orderBy, take }) {
    let results = Array.from(this.tasks.values());
    if (where?.status) results = results.filter(t => t.status === where.status);
    // ... implement filtering, sorting, pagination
    return results.slice(0, take);
  }

  async update(id, data) {
    const task = this.tasks.get(id);
    if (!task) return null;
    const updated = { ...task, ...data };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id) {
    this.tasks.delete(id);
  }

  clear() {
    this.tasks.clear();
    this.idCounter = 1;
  }
}
```

**Why fakes over mocks:** A fake in-memory repository is more maintainable than 20 lines of `vi.fn()` setup. It behaves like the real thing without the overhead.

---

## API Contract Testing

### WHAT Is Contract Testing?

Contract testing verifies that services can communicate by checking that exchanged messages conform to a shared contract—without requiring both services to run simultaneously.

### WHY Does It Matter?

In microservices, traditional integration testing requires all services deployed to a shared environment. These environments:
- Are expensive to maintain
- Have configuration drift from production
- Are often broken by unrelated teams
- Make parallel development nearly impossible

### WHAT HAPPENS Without Contract Testing?

- "Works in my service" deployments break production
- Late-night pages because Service A changed its response format and Service B crashes
- Release coordination meetings that slow velocity to a crawl
- Integration test environments that are red 50% of the time

### Pact: Consumer-Driven Contract Testing

```javascript
// Consumer test (e.g., Order Service calling User Service)
import { PactV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'OrderService',
  provider: 'UserService',
  dir: './pacts',
});

describe('UserService contract', () => {
  it('returns a user by ID', async () => {
    await provider
      .given('a user exists')
      .uponReceiving('a request for user by ID')
      .withRequest({
        method: 'GET',
        path: '/users/123',
        headers: { Authorization: 'Bearer token' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: 123,
          email: 'user@example.com',
          name: 'Test User',
        },
      });

    await provider.executeTest(async (mockServer) => {
      const userService = new UserService(mockServer.url);
      const user = await userService.getUser(123);
      expect(user.email).toBe('user@example.com');
    });
  });
});
```

```javascript
// Provider verification
import { Verifier } from '@pact-foundation/pact';

describe('Pact Verification', () => {
  it('validates the expectations of OrderService', async () => {
    await new Verifier({
      provider: 'UserService',
      providerBaseUrl: 'http://localhost:3001',
      pactBrokerUrl: 'https://pact-broker.mycompany.com',
      publishVerificationResult: true,
      providerAppVersion: process.env.GIT_COMMIT,
    }).verifyProvider();
  });
});
```

### OpenAPI Validation

```javascript
import { openApiValidator } from 'express-openapi-validator';

app.use(
  openApiValidator({
    apiSpec: './openapi.yaml',
    validateRequests: true,
    validateResponses: true, // Critical for catching drift
  })
);
```

**Combine Pact + OpenAPI:**
- Use **OpenAPI** as the source of truth for API design
- Use **Pact** for consumer-driven contract verification between services
- Use **OpenAPI response validation** in integration tests to catch implementation drift

---

## Load Testing with k6

### WHAT Is Load Testing?

Load testing validates that your Express backend can handle expected traffic. It answers:
- How many concurrent users can we serve?
- What's our p99 latency under load?
- At what point do errors start occurring?
- Do we have memory leaks under sustained load?

### WHY Does Load Testing Matter?

**Real incidents prevented:**
- Database connection pool exhaustion causing cascading failures
- Event loop blocking from synchronous JSON parsing of large payloads
- Memory leaks from uncaught promise rejections accumulating closures
- Redis command queue overflow during traffic spikes

### WHAT HAPPENS If You Don't Load Test?

- "It worked fine in development" → production outage on launch day
- Discovering your ORM generates N+1 queries only when 1000 users hit the site
- Finding out your logging middleware blocks the event loop at 100 RPS
- Unplanned autoscaling costs because you never tested actual resource usage

### k6 Script Example

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Steady state
    { duration: '2m', target: 200 },   // Spike
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% under 200ms
    http_req_failed: ['rate<0.01'],   // Error rate under 1%
  },
};

export default function () {
  const res = http.post('http://localhost:3000/api/v1/tasks', JSON.stringify({
    title: 'Load test task',
    priority: 'medium',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

Run it:
```bash
k6 run load-test.js
```

### Load Testing Best Practices

1. **Test in staging that mirrors production** (same instance sizes, same DB engine)
2. **Use production-like data shapes.** A 1KB JSON body performs very differently from a 1MB body
3. **Monitor application metrics** during tests (event loop lag, memory usage, GC frequency)
4. **Run load tests in CI** against preview deployments to catch regressions
5. **Test beyond expected peak.** If you expect 1000 RPS, test to 3000 RPS to understand failure modes

---

## What Happens When You Test Wrong

### Ignoring Race Conditions

**The inventory oversell bug:**

```javascript
// BAD: Read-check-write race condition
app.post('/api/v1/orders', async (req, res) => {
  const product = await db.product.findById(req.body.productId);
  if (product.stock < req.body.quantity) {
    return res.status(409).json({ error: 'Out of stock' });
  }
  // Race condition: Another request deducts stock between read and write
  await db.product.update({
    where: { id: req.body.productId },
    data: { stock: { decrement: req.body.quantity } },
  });
  // ... create order
});
```

**Without testing race conditions:**
- Two customers buy the last item simultaneously
- Both see `stock: 1` and proceed
- Stock goes to -1
- You oversell a product you don't have
- Customer gets an "Out of stock" email after paying

**How to test race conditions:**

```javascript
it('prevents overselling under concurrent requests', async () => {
  await db.product.create({ id: 'prod-1', stock: 1 });

  const requests = Array(5).fill().map(() =>
    request(app)
      .post('/api/v1/orders')
      .send({ productId: 'prod-1', quantity: 1 })
  );

  const responses = await Promise.all(requests);
  const successes = responses.filter(r => r.status === 201);
  const failures = responses.filter(r => r.status === 409);

  expect(successes).toHaveLength(1);
  expect(failures).toHaveLength(4);

  const product = await db.product.findById('prod-1');
  expect(product.stock).toBe(0);
});
```

### Only Testing Happy Paths

**The $440M Knight Capital bug** was partly caused by only testing the "normal" trading path. No one tested what happened when a dead flag was activated.

**What happens if you only test happy paths:**
- **Production crashes on edge cases:** Division by zero, null pointer, array out of bounds
- **Security vulnerabilities:** No one tests what happens with negative amounts, SQL injection payloads, or oversized inputs
- **Silent data corruption:** Invalid states accumulate because error paths are untested

**The minimum test matrix:**

| Scenario | Must Test |
|----------|-----------|
| Valid input | Yes (happy path) |
| Missing required field | Yes |
| Invalid type | Yes |
| Boundary values (0, max, max+1) | Yes |
| Empty collections | Yes |
| Null/undefined inputs | Yes |
| Concurrent access | Yes |
| Dependency failure (DB down) | Yes |
| Timeout/scenario | Yes |

---

## CI/CD Integration

### WHAT Is CI/CD for Testing?

Continuous Integration runs your test suite on every code change. Continuous Deployment deploys passing code automatically.

### WHY Does CI Matter for Testing?

- **Enforces discipline:** Tests must pass before merge
- **Catches environment differences:** "Works on my machine" fails in CI
- **Enables parallel development:** Multiple developers work on features simultaneously
- **Provides audit trail:** Every deployment is traceable to passing tests

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test & Lint

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:run -- --reporter=verbose

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

  coverage:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Parallelization Strategies

```yaml
# Shard tests across multiple runners
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx vitest run --shard=${{ matrix.shard }}/4
```

### Flaky Test Management

**What makes tests flaky:**
1. Asynchronous timing (`setTimeout`, promise races)
2. Shared state (database records leaking between tests)
3. External services (calling real APIs that may timeout)
4. Time dependencies (tests that fail near midnight)
5. Randomness (`Math.random()` without seeding)

**Martin Fowler's Quarantine Strategy:**

```yaml
jobs:
  deterministic-tests:
    - run: npm test -- --exclude=flaky/
  
  quarantined-tests:
    - run: npm test -- flaky/
    continue-on-error: true  # Don't block merge, but monitor
```

**Rules:**
- Move flaky tests to a separate suite immediately
- Set a time limit (1 week) to fix or delete quarantined tests
- Never let quarantined tests exceed 5% of total suite

---

## Mini Project: Test Suite for Task Management API

Build a complete test suite for the Task Management API from Module 05.

### Project Structure

```
task-api/
├── src/
│   ├── app.js
│   ├── routes/
│   ├── services/
│   ├── validators/
│   ├── errors/
│   └── middleware/
├── test/
│   ├── setup.js              # Test database setup
│   ├── unit/
│   │   ├── task.service.test.js
│   │   └── validators.test.js
│   ├── integration/
│   │   ├── tasks.routes.test.js
│   │   └── auth.test.js
│   └── fakes/
│       └── InMemoryTaskRepository.js
├── vitest.config.js
└── package.json
```

### 1. Unit Tests: Task Service

```javascript
// test/unit/task.service.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService } from '../../src/services/task.service.js';
import { InMemoryTaskRepository } from '../fakes/InMemoryTaskRepository.js';
import { NotFoundError, ValidationError } from '../../src/errors/AppError.js';

describe('TaskService', () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = new InMemoryTaskRepository();
    service = new TaskService(repository);
  });

  describe('create', () => {
    it('creates a task with default values', async () => {
      const task = await service.create({ title: 'Test task' });

      expect(task.id).toMatch(/^task-/);
      expect(task.title).toBe('Test task');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.createdAt).toBeDefined();
    });

    it('creates a task with all fields', async () => {
      const task = await service.create({
        title: 'Urgent bug',
        description: 'Critical production issue',
        status: 'in_progress',
        priority: 'urgent',
        assigneeId: 'user-123',
      });

      expect(task.priority).toBe('urgent');
      expect(task.assigneeId).toBe('user-123');
    });

    it('trims the title', async () => {
      const task = await service.create({ title: '  Trim me  ' });
      expect(task.title).toBe('Trim me');
    });
  });

  describe('findById', () => {
    it('returns a task by ID', async () => {
      const created = await service.create({ title: 'Find me' });
      const found = await service.findById(created.id);
      expect(found.title).toBe('Find me');
    });

    it('throws NotFoundError for missing task', async () => {
      await expect(service.findById('task-nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('returns paginated results', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ title: `Task ${i}` });
      }

      const result = await service.list({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.has_more).toBe(true);
      expect(result.pagination.next_cursor).toBeDefined();
    });

    it('filters by status', async () => {
      await service.create({ title: 'Todo', status: 'todo' });
      await service.create({ title: 'Done', status: 'done' });

      const result = await service.list({ status: 'done' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Done');
    });

    it('filters by priority', async () => {
      await service.create({ title: 'Low', priority: 'low' });
      await service.create({ title: 'High', priority: 'high' });

      const result = await service.list({ priority: 'high' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('High');
    });

    it('sorts by created_at descending by default', async () => {
      const task1 = await service.create({ title: 'First' });
      await new Promise(r => setTimeout(r, 10)); // Ensure different timestamps
      const task2 = await service.create({ title: 'Second' });

      const result = await service.list({ sort: '-created_at' });

      expect(result.data[0].id).toBe(task2.id);
      expect(result.data[1].id).toBe(task1.id);
    });
  });

  describe('update', () => {
    it('updates task fields', async () => {
      const task = await service.create({ title: 'Original' });
      const updated = await service.update(task.id, { title: 'Updated', status: 'done' });

      expect(updated.title).toBe('Updated');
      expect(updated.status).toBe('done');
      expect(updated.createdAt).toBe(task.createdAt); // Unchanged
    });

    it('throws NotFoundError for missing task', async () => {
      await expect(service.update('task-nonexistent', { title: 'X' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('deletes a task', async () => {
      const task = await service.create({ title: 'Delete me' });
      await service.delete(task.id);

      await expect(service.findById(task.id))
        .rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for missing task', async () => {
      await expect(service.delete('task-nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });
});
```

### 2. Unit Tests: Validators

```javascript
// test/unit/validators.test.js
import { describe, it, expect } from 'vitest';
import { CreateTaskSchema, UpdateTaskSchema, TaskQuerySchema } from '../../src/validators/tasks.schema.js';

describe('CreateTaskSchema', () => {
  it('validates a complete task', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'Valid task',
      description: 'A description',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2024-12-31T23:59:59Z',
      assigneeId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('requires title', () => {
    const result = CreateTaskSchema.safeParse({ description: 'No title' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['title']);
  });

  it('rejects empty title', () => {
    const result = CreateTaskSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title over 200 chars', () => {
    const result = CreateTaskSchema.safeParse({ title: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('defaults status to todo', () => {
    const result = CreateTaskSchema.parse({ title: 'Default test' });
    expect(result.status).toBe('todo');
  });

  it('rejects invalid status', () => {
    const result = CreateTaskSchema.safeParse({ title: 'X', status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'X',
      assigneeId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'X',
      dueDate: 'tomorrow',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateTaskSchema', () => {
  it('allows partial updates', () => {
    const result = UpdateTaskSchema.safeParse({ status: 'done' });
    expect(result.success).toBe(true);
  });

  it('allows empty object', () => {
    const result = UpdateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('TaskQuerySchema', () => {
  it('coerces limit to number', () => {
    const result = TaskQuerySchema.parse({ limit: '50' });
    expect(result.limit).toBe(50);
  });

  it('enforces max limit', () => {
    const result = TaskQuerySchema.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });

  it('defaults sort to -created_at', () => {
    const result = TaskQuerySchema.parse({});
    expect(result.sort).toBe('-created_at');
  });
});
```

### 3. Integration Tests: Routes

```javascript
// test/integration/tasks.routes.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';

describe('Tasks Routes (Integration)', () => {
  let app;
  let testDb;

  beforeAll(async () => {
    testDb = await setupTestDb();
    app = createApp(testDb.prisma);
  }, 60000);

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.prisma.task.deleteMany();
  });

  describe('POST /api/v1/tasks', () => {
    it('creates a task with 201', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .send({ title: 'Integration test task' })
        .expect(201);

      expect(res.body.title).toBe('Integration test task');
      expect(res.body.id).toBeDefined();
      expect(res.headers.location).toContain(res.body.id);
    });

    it('returns 422 for invalid input', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .send({ title: '' })
        .expect(422);

      expect(res.body.type).toContain('validation-failed');
      expect(res.body.errors).toBeInstanceOf(Array);
    });

    it('returns 422 for missing title', async () => {
      await request(app)
        .post('/api/v1/tasks')
        .send({ priority: 'high' })
        .expect(422);
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('returns empty list when no tasks', async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.has_more).toBe(false);
    });

    it('returns paginated tasks', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/tasks')
          .send({ title: `Task ${i}` });
      }

      const res = await request(app)
        .get('/api/v1/tasks?limit=2')
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.has_more).toBe(true);
    });

    it('filters by status', async () => {
      await request(app).post('/api/v1/tasks').send({ title: 'Todo', status: 'todo' });
      await request(app).post('/api/v1/tasks').send({ title: 'Done', status: 'done' });

      const res = await request(app)
        .get('/api/v1/tasks?status=done')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Done');
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('returns a task by ID', async () => {
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .send({ title: 'Find me' });

      const res = await request(app)
        .get(`/api/v1/tasks/${createRes.body.id}`)
        .expect(200);

      expect(res.body.title).toBe('Find me');
    });

    it('returns 404 for non-existent task', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/task-nonexistent')
        .expect(404);

      expect(res.body.type).toContain('task-not-found');
      expect(res.body.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('partially updates a task', async () => {
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .send({ title: 'Original', status: 'todo' });

      const res = await request(app)
        .patch(`/api/v1/tasks/${createRes.body.id}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(res.body.status).toBe('in_progress');
      expect(res.body.title).toBe('Original'); // Unchanged
    });

    it('returns 404 for non-existent task', async () => {
      await request(app)
        .patch('/api/v1/tasks/task-nonexistent')
        .send({ status: 'done' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('deletes a task with 204', async () => {
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .send({ title: 'Delete me' });

      await request(app)
        .delete(`/api/v1/tasks/${createRes.body.id}`)
        .expect(204);

      await request(app)
        .get(`/api/v1/tasks/${createRes.body.id}`)
        .expect(404);
    });

    it('returns 404 for non-existent task', async () => {
      await request(app)
        .delete('/api/v1/tasks/task-nonexistent')
        .expect(404);
    });
  });
});
```

### 4. Fake Repository for Unit Tests

```javascript
// test/fakes/InMemoryTaskRepository.js
export class InMemoryTaskRepository {
  constructor() {
    this.tasks = new Map();
    this.idCounter = 1;
  }

  async create(data) {
    const task = {
      id: `task-${this.idCounter++}`,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async findById(id) {
    return this.tasks.get(id) || null;
  }

  async findMany({ where, orderBy, take, cursor } = {}) {
    let results = Array.from(this.tasks.values());

    if (where) {
      if (where.status) results = results.filter(t => t.status === where.status);
      if (where.priority) results = results.filter(t => t.priority === where.priority);
      if (where.assigneeId) results = results.filter(t => t.assigneeId === where.assigneeId);
    }

    // Simple sorting (only supports single field for demo)
    if (orderBy) {
      const [field, direction] = Object.entries(orderBy)[0];
      results.sort((a, b) => {
        const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
        return direction === 'desc' ? -cmp : cmp;
      });
    }

    // Cursor pagination
    if (cursor) {
      const idx = results.findIndex(t => t.id === cursor.id);
      if (idx !== -1) results = results.slice(idx + 1);
    }

    const hasMore = results.length > take;
    const data = hasMore ? results.slice(0, take) : results;

    return { data, hasMore, nextCursor: hasMore ? { id: data[data.length - 1].id } : null };
  }

  async update(id, data) {
    const task = this.tasks.get(id);
    if (!task) return null;
    const updated = { ...task, ...data, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id) {
    this.tasks.delete(id);
  }

  clear() {
    this.tasks.clear();
    this.idCounter = 1;
  }
}
```

### 5. Test Setup

```javascript
// test/setup.js
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

let container;

export async function setupTestDb() {
  container = await new PostgreSqlContainer('postgres:16').start();
  const databaseUrl = container.getConnectionUri();

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  return { container, prisma, databaseUrl };
}

export async function teardownTestDb() {
  await container?.stop();
}
```

### Running the Suite

```bash
# Run all tests
npm test

# Run only unit tests
npx vitest run test/unit

# Run only integration tests
npx vitest run test/integration

# Watch mode
npx vitest

# With coverage
npx vitest run --coverage

# Load test with k6
k6 run test/load/tasks.load.js
```

### Coverage Targets

```javascript
// vitest.config.js
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        'src/services/**': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/validators/**': {
          branches: 80,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  },
});
```

---

## Summary

| Concept | WHAT | WHY | WHAT HAPPENS IF WRONG |
|---------|------|-----|----------------------|
| **Testing pyramid** | 70% unit, 20% integration, 10% E2E | Unit tests are fast and cheap; E2E is expensive and flaky | Hours debugging simple logic errors, "works on my machine", flaky CI |
| **Vitest over Jest** | Native ESM, Vite integration, faster | Unified pipeline, no Babel overhead, instant watch mode | Slow CI, memory leaks, ESM config hell |
| **Extract business logic** | Services with dependency injection | Unit tests require no HTTP server or database | No unit tests possible, tight coupling, slow test suites |
| **Testcontainers** | Real database in Docker for tests | SQLite differs from PostgreSQL in critical ways | "Tests pass, production 500s" on Postgres-specific features |
| **Supertest** | HTTP assertions binding directly to Express app | No port binding, fast, chainable API | Port conflicts, slower tests, CI fragility |
| **Mocking** | Test doubles for slow/non-deterministic deps | Isolate units, simulate failures | False confidence, brittle tests, missed integration bugs |
| **Contract testing (Pact)** | Consumer-driven API contract verification | Services change independently; catch incompatibilities | "Works in my service" breaking production, late-night pages |
| **Load testing (k6)** | Validate performance under traffic | Find breaking points before users do | Launch day outages, surprise autoscaling bills, event loop blocking |
| **Race condition tests** | Concurrent requests to verify atomicity | Networks are concurrent; without tests, race conditions lurk | Inventory oversell, double charges, data corruption |
| **Happy path coverage** | Testing only the "normal" case | Edge cases are where bugs hide | Production crashes on edge cases, security vulnerabilities |
| **CI/CD integration** | Automated test runs on every change | Enforces discipline, catches environment differences | "Works on my machine", manual QA bottlenecks, fear-based releases |

---

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [Node.js Test Runner (v26 docs)](https://nodejs.org/api/test.html)
- [Testcontainers for Node.js](https://node.testcontainers.org/)
- [Pact - Consumer-Driven Contracts](https://pact.io/)
- [Grafana k6 Documentation](https://k6.io/docs/)
- [Stryker Mutator](https://stryker-mutator.io/)
- [Martin Fowler - Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html)
- [Principles of Chaos Engineering](https://principlesofchaos.org/)
- [Supertest (GitHub)](https://github.com/forwardemail/supertest)
- [The $440M Knight Capital Bug (Medium)](https://medium.com/@ctford/knight-capital-440m-error-2e10951ec2b5)
