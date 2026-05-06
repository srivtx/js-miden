# Module 11: Advanced Patterns — Architecture That Scales

> **"Complexity should be introduced, not discovered."**
>
> This module is about deliberately choosing architecture patterns before your codebase chooses them for you — usually at 2 AM during an outage.

---

## Table of Contents

1. [YAGNI: You Aren't Gonna Need It](#1-yagni-you-arent-gonna-need-it)
2. [Dependency Injection](#2-dependency-injection)
3. [Repository Pattern](#3-repository-pattern)
4. [Service Layer Pattern](#4-service-layer-pattern)
5. [Factory Pattern](#5-factory-pattern)
6. [Observer Pattern](#6-observer-pattern)
7. [CQRS Basics](#7-cqrs-basics)
8. [Event Sourcing Introduction](#8-event-sourcing-introduction)
9. [Circuit Breaker Pattern](#9-circuit-breaker-pattern)
10. [Bulkhead Pattern](#10-bulkhead-pattern)
11. [Rate Limiter Algorithms](#11-rate-limiter-algorithms)
12. [Background Jobs with Bull/Queue](#12-background-jobs-with-bullqueue)
13. [File Upload Handling](#13-file-upload-handling)
14. [Pagination Strategies Deep Dive](#14-pagination-strategies-deep-dive)
15. [Anti-Patterns: Business Logic in Controllers](#15-anti-patterns-business-logic-in-controllers)
16. [Anti-Patterns: Missing Circuit Breakers](#16-anti-patterns-missing-circuit-breakers)
17. [Flat Architecture & Vertical Slices](#17-flat-architecture--vertical-slices)
18. [Mini Project: Refactored Task API](#18-mini-project-refactor-task-api)

---

## 1. YAGNI: You Aren't Gonna Need It

### WHAT Is YAGNI?

YAGNI is a principle of extreme programming: **don't add functionality until it's actually needed.** Every abstraction you add today is code you have to maintain, test, document, and explain to new team members.

### WHY Does It Matter?

```typescript
// YAGNI violation: Abstracting for a future that never comes
interface IPaymentProcessor {
  process(amount: number, currency: string): Promise<Transaction>;
  refund(transactionId: string): Promise<void>;
  getSupportedCurrencies(): string[];
}

class StripePaymentProcessor implements IPaymentProcessor { /* ... */ }
class PayPalPaymentProcessor implements IPaymentProcessor { /* ... */ }
class CryptoPaymentProcessor implements IPaymentProcessor { /* ... */ }

// Reality: You only use Stripe. You built 3 payment processors for a startup with 50 users.
```

**The cost of premature abstraction:**
- **Cognitive load:** New developers must understand 5 layers before fixing a bug
- **Refactoring friction:** Changing simple logic requires updating interfaces, tests, and mocks
- **Slower delivery:** A feature that should take 2 hours takes 2 days
- **Dead code:** Abstractions for features that were never built

### The Pragmatic Rule

> **Build for the next 6 months, not the next 6 years.**

| Stage | Architecture Approach |
|-------|---------------------|
| 0-100 users | Direct database calls in route handlers are fine |
| 100-1,000 users | Extract reusable functions, add basic validation |
| 1,000-10,000 users | Add Repository + Service layers |
| 10,000+ users | Consider CQRS, event sourcing, microservices |

### WHAT HAPPENS If You Ignore YAGNI?

**The abstraction graveyard:**

A startup with 200 users built:
- A plugin architecture (0 plugins written)
- Multi-tenant database sharding (1 tenant: themselves)
- Event sourcing for user preferences (never queried historically)
- A custom DI container (20 lines of manual DI would suffice)

Result: 60% of their codebase served no current purpose. Onboarding took 3 weeks. Simple bug fixes required understanding 4 layers of indirection.

### When to Break YAGNI

Break YAGNI when:
- The cost of retrofitting is demonstrably higher than the abstraction
- You're building a library/framework (the abstraction IS the product)
- You have empirical data that a specific scaling need is imminent
- Compliance/regulatory requirements mandate separation

**Default to simplicity. Add complexity only when it pays rent.**

---

## 2. Dependency Injection

### WHAT Is It?

Dependency Injection (DI) is a design pattern where a class or function receives its dependencies from external sources rather than creating them internally. Instead of `import { db } from './db'` inside a service, the service receives `db` through its constructor or parameters.

```typescript
// WITHOUT DI: Hard-coded dependency
import { prisma } from './db';

class UserService {
  async createUser(data) {
    return prisma.user.create({ data }); // Locked to Prisma
  }
}

// WITH DI: Dependency injected
class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(data) {
    return this.userRepository.create(data); // Works with ANY repository
  }
}
```

### WHY Use It?

DI solves three critical problems:

1. **Testability**: You can swap real dependencies for mocks, stubs, or fakes in tests
2. **Decoupling**: Services don't know about Prisma, MongoDB, or Redis — they know about interfaces
3. **Flexibility**: Swap PostgreSQL for MySQL without touching business logic

From the testing research:

> "Singletons (modules that export a single instance) are the enemy of testability... A team at a fintech company had 200+ tests that passed individually but failed 30% of the time in CI. Root cause: a singleton Redis client shared across tests with race conditions on key expiration."

### WHAT HAPPENS If We Don't Use It?

```javascript
// The singleton trap
db.js:
  export const prisma = new PrismaClient(); // One global instance

user.service.js:
  import { prisma } from './db'; // Hard-coded

// Tests:
// - Can't run in parallel (shared DB state)
// - Can't mock database errors
// - Can't test with in-memory fakes
// - Order-dependent test failures
// - 30-second test suites instead of 3-second suites
```

**Technical debt accumulates fast:**
- Tests require Docker containers for every unit test
- CI pipelines take 20+ minutes
- Developers stop writing tests because "they're too slow"
- Code coverage drops
- Refactoring becomes terrifying because "we don't know what will break"

### When NOT to Use Dependency Injection

**Don't use DI when:**
- Your app has < 10 routes and 2 database models (overkill)
- You're building a prototype or MVP (speed matters more than testability)
- Your team doesn't understand the pattern (confusion > benefit)
- Every service is a singleton with no external dependencies

**The shortcut:** Start with direct imports. Extract interfaces only when you need to swap implementations (testing, database migration, third-party service change).

> **The Pragmatic Shortcut**
>
> Manual DI is enough for 90% of Express apps. You don't need Awilix or InversifyJS until you have 50+ injectable services.
>
> ```typescript
> // composition.ts — 20 lines, zero dependencies
> export function createApp() {
>   const prisma = new PrismaClient();
>   const userRepo = new PrismaUserRepository(prisma);
>   const userService = new UserService(userRepo);
>   return buildExpressApp(userService);
> }
> ```

### LATEST Implementations

**Manual DI (Recommended for most Express apps):**

```typescript
// composition.ts — the "composition root"
export function createApp() {
  const prisma = new PrismaClient();
  
  const userRepository = new PrismaUserRepository(prisma);
  const emailService = new SendGridEmailService();
  const cacheClient = new RedisCacheClient(redis);
  
  const userService = new UserService({
    userRepository,
    emailService,
    cacheClient,
  });
  
  const userController = new UserController(userService);
  
  return { app: buildExpressApp(userController) };
}
```

**DI Containers (for larger apps):**

- **Awilix**: Popular DI container with lifecycle management (`SCOPED`, `SINGLETON`, `TRANSIENT`)
- **TSyringe**: TypeScript-friendly DI by Microsoft, using decorators
- **InversifyJS**: Powerful but verbose; better for complex domain models

```javascript
// Awilix example
import { createContainer, asClass, asFunction } from 'awilix';

const container = createContainer();
container.register({
  userService: asClass(UserService).scoped(),
  userRepository: asClass(PrismaUserRepository).singleton(),
});
```

---

## 3. Repository Pattern

### WHAT Is It?

The Repository Pattern abstracts data access behind an interface. Controllers and services ask a repository for data; the repository decides whether to fetch from PostgreSQL, Redis, or an API.

```typescript
// The contract (interface)
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserDto): Promise<User>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
}

// The implementation
class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}
  
  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
  // ...
}

// The fake (for testing)
class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];
  
  async findById(id: string) {
    return this.users.find(u => u.id === id) || null;
  }
  // ...
}
```

### WHY Use It?

1. **Testability**: Test business logic with in-memory fakes, no database needed
2. **Query encapsulation**: Complex SQL lives in one place, not scattered across controllers
3. **Swapability**: Change from Prisma to Drizzle without touching services
4. **Caching layer**: Repository can check Redis before hitting PostgreSQL

### WHAT HAPPENS If We Don't Use It?

```javascript
// The "query in controller" anti-pattern
app.get('/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      posts: {
        include: { comments: true }
      }
    }
  });
  
  // Business logic mixed with query logic
  if (user.posts.length > 10) {
    user.rank = 'power user';
  }
  
  res.json(user);
});
```

**Consequences:**
- **Same query copied in 6 different endpoints** — when the schema changes, you update 6 places
- **Cannot unit test the ranking logic** without spinning up PostgreSQL
- **Cannot swap to a different database** without rewriting every route
- **N+1 queries proliferate** because there's no central place to optimize
- **Authorization leaks**: No central place to enforce `WHERE tenant_id = ?`

### When NOT to Use Repository Pattern

**Don't use repositories when:**
- Your queries are simple CRUD with no business logic (Prisma Client IS your repository)
- You have < 5 models and no complex query logic
- Your team prefers query builders or raw SQL for everything
- You're using a micro-ORM like Drizzle where the ORM itself is thin enough

**The shortcut:** Use Prisma directly in services for simple apps. Extract a repository only when:
- You need caching logic (Redis check before DB hit)
- You need to enforce tenant isolation on every query
- You plan to swap ORMs or databases
- You want to unit test without a database

### LATEST Implementations

**Prisma Repository Pattern (2025):**

```typescript
// Base repository with common operations
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  constructor(protected model: any) {}
  
  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }
  
  async create(data: CreateInput): Promise<T> {
    return this.model.create({ data });
  }
  
  async update(id: string, data: UpdateInput): Promise<T> {
    return this.model.update({ where: { id }, data });
  }
}

// Specific repository extends base
export class UserRepository extends BaseRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput> {
  constructor(prisma: PrismaClient) {
    super(prisma.user);
  }
  
  async findByEmail(email: string) {
    return this.model.findUnique({ where: { email } });
  }
  
  async findActiveUsers(organizationId: string) {
    return this.model.findMany({
      where: { organizationId, status: 'active' },
      orderBy: { lastActiveAt: 'desc' },
    });
  }
}
```

---

## 3. Service Layer Pattern

### WHAT Is It?

The Service Layer is where business logic lives. It's the "brain" of your application — it orchestrates repositories, enforces business rules, and coordinates operations. Controllers should be thin; services should be thick.

```typescript
// Controller: HTTP in, HTTP out
class OrderController {
  constructor(private orderService: OrderService) {}
  
  async createOrder(req, res) {
    try {
      const order = await this.orderService.createOrder({
        userId: req.user.id,
        items: req.body.items,
        shippingAddress: req.body.shippingAddress,
      });
      res.status(201).json(order);
    } catch (err) {
      if (err instanceof InsufficientInventoryError) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
  }
}

// Service: Business logic, no HTTP
class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private inventoryRepository: InventoryRepository,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
  ) {}
  
  async createOrder(input: CreateOrderInput) {
    // 1. Validate business rules
    if (input.items.length === 0) {
      throw new ValidationError('Order must contain at least one item');
    }
    
    // 2. Check inventory (repository)
    for (const item of input.items) {
      const available = await this.inventoryRepository.checkAvailability(item.productId, item.quantity);
      if (!available) {
        throw new InsufficientInventoryError(item.productId);
      }
    }
    
    // 3. Reserve inventory
    await this.inventoryRepository.reserveItems(input.items);
    
    // 4. Calculate totals
    const subtotal = await this.calculateSubtotal(input.items);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    
    // 5. Create order
    const order = await this.orderRepository.create({
      userId: input.userId,
      items: input.items,
      subtotal,
      tax,
      total,
      status: 'pending_payment',
    });
    
    // 6. Notify
    await this.notificationService.sendOrderConfirmation(order);
    
    return order;
  }
}
```

### WHY Use It?

1. **Testability**: Test business rules without HTTP overhead
2. **Reusability**: The same service can be called from REST API, GraphQL resolver, CLI tool, or background job
3. **Clarity**: Business rules are centralized, not scattered across routes
4. **Transaction boundaries**: Service methods define clear transaction scopes

### WHAT HAPPENS If We Don't Use It?

From the testing research:

> "Extract business logic from route handlers. Route handlers should be thin orchestrators. Test the service layer in unit tests, not via HTTP calls."

```javascript
// The "fat controller" anti-pattern
app.post('/orders', async (req, res) => {
  const user = await prisma.user.findById(req.user.id);
  if (user.credits < req.body.amount) {
    return res.status(400).json({ error: 'Insufficient credits' });
  }
  
  const order = await prisma.order.create({ data: req.body });
  
  // 50 more lines of business logic...
  
  await sendEmail(user.email, 'Order created');
  
  res.json(order);
});
```

**Consequences:**
- **Cannot test business logic without HTTP server** — every test needs supertest
- **Cannot reuse logic** — the "insufficient credits" check is trapped in an Express route
- **Cannot call from CLI** — want to create orders via a script? Copy-paste the code
- **HTTP concerns leak into business logic** — `res.status(400)` inside business rules
- **Massive controllers** — 500-line route handlers that no one dares refactor

### When NOT to Use Service Layer

**Don't use a service layer when:**
- Your route handlers are under 20 lines with no business rules
- You're building a prototype where requirements change daily
- Your "business logic" is just CRUD with no calculations or side effects
- You have one client (a web frontend) and no CLI, background jobs, or API consumers

**The shortcut:** Keep logic in route handlers until you need to:
- Call the same operation from multiple entry points (HTTP, CLI, queue worker)
- Write unit tests without spinning up Express
- Coordinate multiple models in one operation

### LATEST Implementations

**2025 Best Practice**: Services return domain errors, controllers map to HTTP:

```typescript
// Domain errors
export class DomainError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export class InsufficientFundsError extends DomainError {
  constructor() {
    super('Insufficient funds', 'INSUFFICIENT_FUNDS');
  }
}

// Service throws domain errors
class PaymentService {
  async processPayment(userId: string, amount: number) {
    const user = await this.userRepository.findById(userId);
    if (user.balance < amount) {
      throw new InsufficientFundsError();
    }
    // ...
  }
}

// Controller maps to HTTP
app.post('/payments', async (req, res, next) => {
  try {
    const result = await paymentService.processPayment(req.user.id, req.body.amount);
    res.json(result);
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return res.status(402).json({ error: err.code, message: err.message });
    }
    next(err);
  }
});
```

---

## 4. Factory Pattern

### WHAT Is It?

The Factory Pattern creates objects without specifying the exact class. Instead of `new UserService()`, you call `ServiceFactory.createUserService()`, which decides which implementation to return based on configuration.

```typescript
// Factory function
function createPaymentService(config: Config): PaymentService {
  switch (config.paymentProvider) {
    case 'stripe':
      return new StripePaymentService(config.stripeKey);
    case 'paypal':
      return new PayPalPaymentService(config.paypalKey);
    case 'mock':
      return new MockPaymentService();
    default:
      throw new Error(`Unknown payment provider: ${config.paymentProvider}`);
  }
}

// Usage
const paymentService = createPaymentService(process.env);
```

### WHY Use It?

1. **Configuration-driven behavior**: Switch providers via environment variables
2. **Test environments**: Return mocks in test mode
3. **Feature flags**: Return new implementations gradually
4. **Dependency bundling**: Factory creates the object graph in one place

### WHAT HAPPENS If We Don't Use It?

```javascript
// Hard-coded instantiation everywhere
import { StripePaymentService } from './stripe.service';

class OrderService {
  constructor() {
    this.paymentService = new StripePaymentService(process.env.STRIPE_KEY);
  }
}

// Want to test? Too bad — Stripe service is hard-coded
// Want to switch to PayPal? Update 20 files
// Want to mock in tests? Use jest.mock() hacks
```

### When NOT to Use Factory Pattern

**Don't use factories when:**
- You have one implementation and no plans to change it
- Configuration is static (just use `new` with env vars)
- The factory adds indirection without enabling swaps

**The shortcut:** Use a simple function that returns the implementation based on an env var. You don't need a Factory *class* until you have complex initialization logic.

### LATEST Implementations

**Factory with DI Container (Awilix):**

```typescript
container.register({
  paymentService: asFunction(({ config }) => {
    if (config.NODE_ENV === 'test') {
      return new MockPaymentService();
    }
    return new StripePaymentService(config.STRIPE_KEY);
  }).singleton(),
});
```

---

## 5. Observer Pattern

### WHAT Is It?

The Observer Pattern defines a one-to-many dependency between objects. When one object (the subject) changes state, all its dependents (observers) are notified automatically. In Node.js, this is built into the language via `EventEmitter`.

```typescript
import { EventEmitter } from 'events';

// The event bus (subject)
class DomainEventBus extends EventEmitter {
  emitEvent(event: DomainEvent) {
    this.emit(event.type, event);
  }
}

// Observers
class NotificationObserver {
  constructor(private eventBus: DomainEventBus) {
    this.eventBus.on('user.registered', this.sendWelcomeEmail.bind(this));
    this.eventBus.on('order.created', this.sendOrderConfirmation.bind(this));
  }
  
  private async sendWelcomeEmail(event: UserRegisteredEvent) {
    await emailService.send({
      to: event.payload.email,
      template: 'welcome',
    });
  }
}

class AuditObserver {
  constructor(private eventBus: DomainEventBus) {
    this.eventBus.on('*', this.logEvent.bind(this));
  }
  
  private async logEvent(event: DomainEvent) {
    await auditRepository.create({
      type: event.type,
      payload: event.payload,
      timestamp: new Date(),
    });
  }
}
```

### WHY Use It?

1. **Decoupling**: Services don't need to know about notification, audit, or analytics systems
2. **Extensibility**: Add new side effects without changing the original code
3. **Background work**: Trigger async jobs without blocking the request
4. **Audit trails**: Log every important action automatically

### WHAT HAPPENS If We Don't Use It?

```javascript
// Tightly coupled side effects
class UserService {
  async registerUser(data) {
    const user = await this.userRepository.create(data);
    
    // Direct coupling to 5 different systems
    await this.emailService.sendWelcome(user.email);
    await this.analytics.track('user_registered', user);
    await this.slack.notify(`New user: ${user.email}`);
    await this.auditLog.create('user.registered', user);
    await this.searchIndex.indexUser(user);
    
    return user;
  }
}
```

**Consequences:**
- **Registration takes 3 seconds** because it waits for Slack, analytics, and search indexing
- **One failing side effect breaks registration** — if Slack is down, user can't sign up
- **Adding a new side effect requires modifying the UserService** — violating Open/Closed principle
- **Cannot disable side effects in tests** — tests become integration tests by default

### When NOT to Use Observer Pattern

**Don't use observers when:**
- Your events have exactly one consumer (just call the function directly)
- Ordering of side effects matters (event buses make ordering implicit and fragile)
- You need the result of the side effect in the main flow (observers are fire-and-forget)

**The shortcut:** Start with direct function calls. Switch to EventEmitter or a queue only when you have 3+ independent side effects or need to process asynchronously.

### LATEST Implementations

**2025: Event-Driven with BullMQ:**

```typescript
import { Queue } from 'bullmq';

// Instead of EventEmitter, use a queue for durability
const eventQueue = new Queue('domain-events', { connection: redis });

class UserService {
  async registerUser(data) {
    const user = await this.userRepository.create(data);
    
    // Fire and forget — queue handles delivery
    await eventQueue.add('user.registered', {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    });
    
    return user;
  }
}

// Workers process events independently
const worker = new Worker('domain-events', async (job) => {
  switch (job.name) {
    case 'user.registered':
      await Promise.all([
        emailService.sendWelcome(job.data.email),
        analytics.track('user_registered', job.data),
        auditLog.create('user.registered', job.data),
      ]);
      break;
  }
}, { connection: redis });
```

---

## 6. CQRS Basics

### WHAT Is It?

CQRS (Command Query Responsibility Segregation) separates read models from write models. Commands (writes) use one data model; Queries (reads) use another, optimized for specific read patterns.

```
┌─────────────┐      Commands      ┌─────────────┐
│   Client    │ ────────────────► │  Write DB   │
│             │                   │ (Normalized)│
│             │ ◄──────────────── │  PostgreSQL │
└─────────────┘      Events       └──────┬──────┘
                                         │
                                    Event Bus
                                    (Redis/RabbitMQ)
                                         │
                                         ▼
                                    ┌─────────────┐
                                    │  Read DB    │
                                    │(Denormalized)│
                                    │  MongoDB    │
                                    │Elasticsearch│
                                    └─────────────┘
```

### WHY Use It?

1. **Read optimization**: Denormalize data for fast queries
2. **Write optimization**: Keep writes simple and transactional
3. **Independent scaling**: Scale reads and writes separately
4. **Complex queries**: Use Elasticsearch for search, MongoDB for aggregations

### WHAT HAPPENS If We Don't Use It?

```javascript
// One model for everything
// The "order" table has 50 columns because:
// - 20 columns for the write model (order creation)
// - 20 columns for the admin dashboard (aggregations)
// - 10 columns for the customer view (denormalized product info)

// Result:
// - INSERTs are slow (too many indexes)
// - SELECTs require 5 JOINs for the customer view
// - The admin dashboard query times out at 30 seconds
// - Adding a column requires updating 20 queries
```

### When NOT to Use CQRS

**Don't use CQRS when:**
- Your read and write patterns are identical (CRUD apps without complex reporting)
- You have < 10,000 users and simple queries run in < 50ms
- Your team can't handle eventual consistency between read and write models
- You're not sure what your read patterns will be (YAGNI applies)

**The shortcut:** Start with PostgreSQL views or materialized views for read optimization. Only split databases when views aren't enough.

### LATEST Implementations

**Lightweight CQRS with PostgreSQL + Views:**

```typescript
// Command model (normalized)
class OrderCommandService {
  async createOrder(input) {
    return prisma.order.create({
      data: {
        userId: input.userId,
        items: { create: input.items },
        status: 'pending',
      },
    });
  }
}

// Read model (materialized view)
class OrderQueryService {
  async getOrderSummary(orderId: string) {
    // Uses a denormalized view or projection table
    return prisma.orderSummaryView.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        total: true,
        itemCount: true,
        customerName: true, // Denormalized
        status: true,
      },
    });
  }
}
```

---

## 7. Event Sourcing Introduction

### WHAT Is It?

Event Sourcing stores the state of an entity as a sequence of events rather than storing the current state. To get the current state, you replay all events.

```
Traditional:    User table → { id: 1, name: "John", balance: 100 }

Event Sourcing: User events → [
  { type: "UserCreated", data: { name: "John" } },
  { type: "BalanceAdded", data: { amount: 50 } },
  { type: "BalanceAdded", data: { amount: 50 } },
]

Current state = fold(applyEvent, initialState, events)
```

### WHY Use It?

1. **Audit trail**: Every state change is recorded with when, who, and why
2. **Temporal queries**: "What did the user's balance look like 3 days ago?"
3. **Debugging**: Replay events to reproduce bugs
4. **Analytics**: Stream events to data warehouses

### WHAT HAPPENS If We Don't Use It?

```javascript
// Traditional CRUD
await prisma.order.update({
  where: { id: orderId },
  data: { status: 'shipped' },
});

// The previous status is LOST FOREVER
// When the customer disputes:
// - "When was it shipped?"
// - "Who changed the status?"
// - "What was the tracking number at the time?"
// Answer: ¯\_(ツ)_/¯
```

### When NOT to Use Event Sourcing

**Don't use event sourcing when:**
- You can get audit trails with a simple `created_at`, `updated_at`, `updated_by` audit log
- Your domain model is simple (CRUD without complex state machines)
- Your team doesn't understand eventual consistency and snapshot strategies
- You don't have operational expertise to manage event stores and projections

**The shortcut:** Add an `events` table that logs important state changes. You get 80% of the audit benefit with 10% of the complexity.

### LATEST Implementations

**Hybrid approach (Event Sourcing + Snapshot):**

```typescript
class OrderAggregate {
  private events: DomainEvent[] = [];
  private state: OrderState;
  
  constructor(private snapshot?: OrderSnapshot) {
    this.state = snapshot?.state ?? { status: 'pending', items: [] };
  }
  
  addItem(productId: string, quantity: number, price: number) {
    const event = new ItemAddedEvent({ productId, quantity, price });
    this.apply(event);
    this.events.push(event);
  }
  
  confirmPayment() {
    const event = new PaymentConfirmedEvent({ confirmedAt: new Date() });
    this.apply(event);
    this.events.push(event);
  }
  
  private apply(event: DomainEvent) {
    switch (event.type) {
      case 'ItemAdded':
        this.state.items.push(event.data);
        this.state.total += event.data.price * event.data.quantity;
        break;
      case 'PaymentConfirmed':
        this.state.status = 'paid';
        break;
    }
  }
  
  getEvents(): DomainEvent[] {
    return this.events;
  }
  
  getState(): OrderState {
    return this.state;
  }
}
```

---

## 8. Circuit Breaker Pattern

### WHAT Is It?

A Circuit Breaker monitors failures to an external service. After a threshold of failures, it "opens" and fails fast for a period, giving the failing service time to recover. After a timeout, it "half-opens" to test if recovery occurred.

```
CLOSED  ──► failures > threshold ──►  OPEN
 (normal)                            (fail fast)
   ▲                                    │
   └─── success <── HALF_OPEN ────────┘
          (test recovery)
```

```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime?: number;
  
  constructor(
    private readonly threshold = 5,
    private readonly timeout = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime || 0) > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitOpenError('Service temporarily unavailable');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

### WHY Use It?

1. **Fail fast**: Don't waste resources waiting for timeouts
2. **Prevent cascade failures**: One slow service doesn't exhaust your connection pool
3. **Graceful degradation**: Return cached data or default values
4. **Recovery time**: Give failing services breathing room

### WHAT HAPPENS If We Don't Use It?

From the database research:

> "Without circuit breakers, a slow downstream API causes timeouts, which trigger retries, amplifying the problem."

```javascript
// No circuit breaker
app.get('/dashboard', async (req, res) => {
  const [user, notifications, analytics] = await Promise.all([
    userService.getUser(req.user.id),           // 50ms
    notificationService.getNotifications(),      // TIMEOUT (10s)
    analyticsService.getDashboardData(),         // TIMEOUT (10s)
  ]);
  
  res.json({ user, notifications, analytics });
});

// Result:
// - Request takes 10 seconds
// - 2 connections held open
// - User retries → more connections → more timeouts
// - Eventually: ALL requests fail (cascade failure)
// - Recovery takes 5 minutes after the external service recovers
```

### When NOT to Use Circuit Breaker

**Don't use circuit breakers when:**
- You only call one external API and it has 99.99% uptime (added complexity without benefit)
- Your client library already implements retries and backoff
- You're making synchronous calls within a transaction (circuit breakers can't help transactional failures)

**The shortcut:** Start with timeouts and retries. Add circuit breakers only when you observe cascading failures in production.

### LATEST Implementations

**Opossum (Netflix-style Circuit Breaker):**

```typescript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const breaker = new CircuitBreaker(externalApiCall, options);

breaker.fallback(() => ({ cached: true, data: cache.get('fallback') }));

breaker.on('open', () => console.log('Circuit opened'));
breaker.on('halfOpen', () => console.log('Circuit half-open'));
breaker.on('close', () => console.log('Circuit closed'));

// Usage
app.get('/external-data', async (req, res) => {
  const data = await breaker.fire(req.query.id);
  res.json(data);
});
```

---

## 9. Bulkhead Pattern

### WHAT Is It?

The Bulkhead Pattern isolates failures by partitioning resources. Just like ship bulkheads prevent flooding from spreading, software bulkheads prevent one failing component from consuming all resources.

```
WITHOUT BULKHEADS:                    WITH BULKHEADS:
┌─────────────────┐                   ┌─────┐ ┌─────┐ ┌─────┐
│   Connection    │                   │Auth │ │Order│ │Email│
│     Pool 50     │                   │Pool │ │Pool │ │Pool │
│                 │                   │ 10  │ │ 20  │ │ 10  │
│ All services    │                   │     │ │     │ │     │
│ share one pool  │                   └─────┘ └─────┘ └─────┘
└─────────────────┘                   Failure in email service
                                      doesn't starve orders
```

### WHY Use It?

1. **Failure isolation**: Email service down doesn't affect order processing
2. **Resource protection**: One service can't exhaust the connection pool
3. **Priority preservation**: Critical paths get dedicated resources

### WHAT HAPPENS If We Don't Use It?

```javascript
// One connection pool for everything
const pool = new pg.Pool({ max: 20 });

// Email service gets stuck (SMTP server slow)
// → Holds 20 connections
// → Order service can't get connections
// → Payment service can't get connections
// → EVERYTHING is down because email is slow
```

### When NOT to Use Bulkhead

**Don't use bulkheads when:**
- You have one database and one service (nothing to partition)
- Your connection pool is already small (< 10 connections)
- You don't have distinct traffic classes (everything is equally critical)

**The shortcut:** A single connection pool with reasonable `max` is fine for most apps. Partition only when one feature (e.g., analytics) consistently starves another (e.g., payments).

### LATEST Implementations

**Connection Pool Partitioning:**

```typescript
// Dedicated pools per domain
const pools = {
  critical: new pg.Pool({ max: 10, application_name: 'api-critical' }),
  standard: new pg.Pool({ max: 15, application_name: 'api-standard' }),
  background: new pg.Pool({ max: 5, application_name: 'api-background' }),
};

class OrderRepository {
  private pool = pools.critical; // Orders are critical
}

class EmailRepository {
  private pool = pools.background; // Emails can wait
}
```

**HTTP Agent Partitioning:**

```typescript
import { Agent } from 'http';

const agents = {
  payment: new Agent({ maxSockets: 10 }),
  notification: new Agent({ maxSockets: 5 }),
  analytics: new Agent({ maxSockets: 3 }),
};
```

---

## 10. Rate Limiter Algorithms

### WHAT Is It?

Rate limiting controls how many requests a client can make in a time window. Different algorithms offer different trade-offs between precision and performance.

### Token Bucket

```
Bucket capacity: 10 tokens
Refill rate: 1 token/second

Request arrives: take 1 token
If no tokens: reject (429)
```

```typescript
// Redis Lua implementation (atomic)
const tokenBucketLua = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local refill_rate = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local requested = tonumber(ARGV[4])
  
  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1]) or capacity
  local last_refill = tonumber(bucket[2]) or now
  
  local delta = math.max(0, now - last_refill)
  tokens = math.min(capacity, tokens + delta * refill_rate)
  
  if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate))
    return 1
  else
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    return 0
  end
`;
```

**Pros:** Allows bursts up to bucket capacity; smooths average rate
**Cons:** Burst can overwhelm backends if capacity is too high

### Sliding Window

```
Track every request timestamp in a sorted set.
On each request: count requests in the last N seconds.
```

```typescript
// Sliding window log (precise)
async function slidingWindowCheck(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);
  
  // Count current window
  const current = await redis.zcard(key);
  
  if (current >= limit) {
    return { allowed: false };
  }
  
  // Add current request
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.pexpire(key, windowMs);
  
  return { allowed: true, remaining: limit - current - 1 };
}
```

**Pros:** Precise; no boundary issues
**Cons:** Memory intensive; O(log n) per request

### WHAT HAPPENS If We Use the Wrong Algorithm?

| Algorithm | When It Fails |
|-----------|---------------|
| Fixed Window | Thundering herd at window boundaries (100 req at 0:59 + 100 at 1:00 = 200 in 1 min) |
| Token Bucket (too large) | Burst of traffic overwhelms database |
| Sliding Window (high traffic) | Redis memory exhaustion from storing every request timestamp |

### When NOT to Use Rate Limiting

**Don't build custom rate limiting when:**
- You're behind a CDN (Cloudflare, Fastly) that already provides rate limiting
- Your API gateway (Kong, AWS API Gateway) handles throttling
- You're in early development and don't know your traffic patterns

**The shortcut:** Use `express-rate-limit` with a memory store for single-server apps. Upgrade to Redis only when you scale horizontally.

### LATEST Implementations

**express-rate-limit (2025):**

```typescript
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

// Sliding window with Redis
const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // RateLimit-* headers (IETF draft)
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Tiered limits
const tieredLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => req.user?.plan === 'premium' ? 1000 : 100,
});
```

---

## 11. Background Jobs with Bull/Queue

### WHAT Is It?

Background job queues offload work from the HTTP request cycle. Instead of sending an email during a POST request, you add a job to a queue and respond immediately. A worker processes the job asynchronously.

### WHY Use It?

1. **Response time**: HTTP requests return in milliseconds, not seconds
2. **Reliability**: Failed jobs can be retried with backoff
3. **Rate limiting**: Process jobs at a controlled pace
4. **Scheduling**: Run jobs at specific times or intervals
5. **Decoupling**: Services communicate via queues, not direct calls

### WHAT HAPPENS If We Don't Use It?

```javascript
// Email sent in request cycle
app.post('/register', async (req, res) => {
  const user = await createUser(req.body);
  
  // Synchronous email send — user waits 3 seconds
  await sendEmail({
    to: user.email,
    template: 'welcome',
  });
  
  res.json(user);
});

// Problems:
// - User stares at loading spinner for 3 seconds
// - If email fails, registration appears to fail
// - 100 registrations/minute = 100 SMTP connections
// - No retry if SMTP is temporarily down
// - Cannot scale email workers independently
```

### When NOT to Use Background Jobs

**Don't use queues when:**
- The operation is synchronous by nature (user is waiting for the result)
- The operation takes < 100ms (queue overhead exceeds benefit)
- You're running a single server and can just `setTimeout`

**The shortcut:** Use `setTimeout` or `Promise.all` for simple async work. Add BullMQ only when you need retries, scheduling, or independent worker scaling.

### LATEST Implementations

**BullMQ (2025):**

```typescript
import { Queue, Worker } from 'bullmq';

// Queue definition
const emailQueue = new Queue('emails', { connection: redis });

// Add job (in controller)
await emailQueue.add('send-welcome', {
  to: user.email,
  userId: user.id,
}, {
  delay: 5000, // Delay 5 seconds
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100, // Keep last 100 completed
});

// Worker (separate process)
const worker = new Worker('emails', async (job) => {
  switch (job.name) {
    case 'send-welcome':
      await emailService.sendWelcome(job.data.to);
      break;
    case 'send-password-reset':
      await emailService.sendPasswordReset(job.data.to, job.data.token);
      break;
  }
}, {
  connection: redis,
  concurrency: 5, // Process 5 emails simultaneously
  limiter: {
    max: 10,
    duration: 1000, // 10 emails/second max
  },
});
```

**Job Dashboard (bull-board):**

```typescript
import { createBullBoard } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

const serverAdapter = new ExpressAdapter();

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

---

## 12. File Upload Handling

### WHAT Is It?

File upload handling manages multipart/form-data, validates files, stores them, and serves them back. The key decision is stream vs buffer.

### WHY Use Streaming?

| Approach | Memory | Max File Size | Use Case |
|----------|--------|---------------|----------|
| Buffer (RAM) | High (entire file) | Limited by RAM | Small files (< 5MB) |
| Stream (disk/S3) | Low (chunks) | Virtually unlimited | Large files, video, images |

### WHAT HAPPENS If We Use Buffer for Large Files?

```javascript
// Buffer approach
app.post('/upload', upload.single('file'), (req, res) => {
  const buffer = req.file.buffer; // 100MB in RAM!
  // On 10 concurrent uploads: 1GB RAM consumed
  // Node.js crashes with OOM
});
```

### When NOT to Use Streaming

**Don't stream when:**
- Files are tiny (< 1MB) — buffers are simpler and faster
- You need to process the entire file before responding (e.g., virus scanning)
- Your framework handles file uploads transparently

**The shortcut:** Use `multer` with memory storage for small files. Switch to S3 streaming only when you hit memory limits or need to support large uploads.

### LATEST Implementations

**Multer with S3 Streaming:**

```typescript
import multer from 'multer';
import { S3Client } from '@aws-sdk/client-s3';
import multerS3 from 'multer-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Stream directly to S3 — zero local disk/RAM usage
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const key = `uploads/${Date.now()}-${file.originalname}`;
      cb(null, key);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ url: req.file.location });
});
```

**Local streaming with busboy:**

```typescript
import busboy from 'busboy';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

app.post('/upload', (req, res) => {
  const bb = busboy({ headers: req.headers });
  
  bb.on('file', async (name, file, info) => {
    const writeStream = createWriteStream(`./uploads/${info.filename}`);
    await pipeline(file, writeStream);
  });
  
  bb.on('close', () => {
    res.json({ success: true });
  });
  
  req.pipe(bb);
});
```

---

## 13. Pagination Strategies Deep Dive

### Offset Pagination

```sql
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 1000;
```

**Pros:** Simple; can jump to arbitrary page
**Cons:** O(offset + limit) — page 1000 scans 1000 rows; inconsistent under mutation

### Cursor Pagination

```sql
SELECT * FROM orders 
WHERE (created_at, id) < ('2024-01-01', 123)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Pros:** O(limit) regardless of depth; consistent under mutation; no skipped/duplicated items
**Cons:** Can't jump to arbitrary page; requires unique sort key

### WHAT HAPPENS If We Use Offset at Scale?

```javascript
// Offset pagination on 10M rows
GET /orders?offset=999000&limit=100

// Database must:
// 1. Scan 999,000 rows
// 2. Sort them
// 3. Return the last 100
// Time: 5-10 seconds (timeout!)
// CPU: 100% on database
```

### When NOT to Use Cursor Pagination

**Don't use cursors when:**
- Your dataset is small (< 10,000 rows) — offset is simpler and allows jumping to pages
- Users need to jump to arbitrary pages (e.g., "Go to page 50")
- You're building an admin UI where deep pagination is rare

**The shortcut:** Use offset pagination for admin UIs and small datasets. Use cursor pagination only for user-facing feeds and large datasets.

### LATEST Implementations

**Cursor pagination with Prisma:**

```typescript
const orders = await prisma.order.findMany({
  take: 20,
  skip: 1, // Skip the cursor itself
  cursor: { id: lastSeenId },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
});
```

**Composite cursor (recommended):**

```typescript
function encodeCursor(data: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}

// API response
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwWiIsImlkIjoib3JkLTEyMyJ9",
    "has_more": true
  }
}
```

---

## 14. Anti-Patterns: Business Logic in Controllers

### The Untestable Mess

```javascript
// WHAT NOT TO DO
app.post('/orders', authenticate, async (req, res) => {
  // Validation mixed with business logic mixed with HTTP
  if (!req.body.items || req.body.items.length === 0) {
    return res.status(400).json({ error: 'No items' });
  }
  
  const user = await prisma.user.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Business rule hidden in controller
  let discount = 0;
  if (user.membership === 'gold') discount = 0.2;
  else if (user.membership === 'silver') discount = 0.1;
  
  // Database transaction in controller
  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: { userId: user.id, status: 'pending' }
    });
    
    for (const item of req.body.items) {
      const product = await tx.product.findById(item.productId);
      if (product.stock < item.quantity) {
        throw new Error('Out of stock');
      }
      
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: product.price * (1 - discount),
        }
      });
      
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      });
    }
    
    return order;
  });
  
  // Side effect in controller
  await sendEmail(user.email, 'Order placed');
  
  res.status(201).json(order);
});
```

### Why This Is Disastrous

| Problem | Consequence |
|---------|-------------|
| Cannot test without HTTP | Tests need supertest + database + Express app |
| Cannot reuse logic | CLI script? Copy-paste 50 lines |
| HTTP leaks into business | `res.status(400)` inside domain logic |
| No error boundaries | One `throw` returns 500 with stack trace |
| Schema changes break multiple routes | Query logic copied everywhere |
| Race conditions | No centralized inventory reservation logic |

---

## 15. Anti-Patterns: Missing Circuit Breakers

### The Cascade Failure

```javascript
// Microservice A calls Service B
app.get('/user-profile', async (req, res) => {
  const user = await userService.getUser(req.user.id);
  
  // Service B is slow (5s timeout)
  const preferences = await preferencesService.getPreferences(req.user.id);
  
  // Service C depends on B
  const recommendations = await recommendationsService.getForUser(req.user.id);
  
  res.json({ user, preferences, recommendations });
});

// Service B goes down:
// → /user-profile takes 5 seconds (Service B timeout)
// → 100 concurrent users × 5s = 500 connection-seconds
// → Connection pool exhausted
// → Service A can't serve ANY requests
// → Service D calls Service A → also fails
// → Cascade: A, C, D, E all fail
// → Total outage
```

### Prevention

```typescript
// With circuit breakers
const preferencesBreaker = new CircuitBreaker(
  (userId) => preferencesService.getPreferences(userId),
  { timeout: 1000, threshold: 5 }
);

preferencesBreaker.fallback(() => ({ theme: 'default', language: 'en' }));

app.get('/user-profile', async (req, res) => {
  const [user, preferences, recommendations] = await Promise.allSettled([
    userService.getUser(req.user.id),
    preferencesBreaker.fire(req.user.id),
    recommendationsService.getForUser(req.user.id),
  ]);
  
  res.json({
    user: user.status === 'fulfilled' ? user.value : null,
    preferences: preferences.status === 'fulfilled' ? preferences.value : { theme: 'default' },
    recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
  });
});
```

---

## 17. Flat Architecture & Vertical Slices

### WHAT Is Flat Architecture?

Flat architecture (also called "vertical slices" or "features folders") organizes code by feature rather than by technical layer.

```
TRADITIONAL (Layer-based):          FLAT (Feature-based):
src/                                src/
  controllers/                        features/
    user.controller.ts                  auth/
    order.controller.ts                   register.ts
  services/                             login.ts
    user.service.ts                     reset-password.ts
    order.service.ts                    routes.ts
  repositories/                       tasks/
    user.repository.ts                  create-task.ts
    order.repository.ts                 assign-task.ts
  models/                               complete-task.ts
    user.model.ts                       routes.ts
    order.model.ts                  shared/
                                      db.ts
                                      errors.ts
```

### WHY Flat Architecture?

1. **Cohesion:** Everything related to "tasks" lives together. You don't jump between 4 folders to change one feature.
2. **Scaffolding:** Adding a new feature means adding one folder, not files scattered across the codebase.
3. **Deletion:** Remove a feature? Delete one folder. In layer-based architecture, orphaned files litter the codebase.
4. **Onboarding:** New developers find everything for a feature in one place.

### The Pragmatic Shortcut

> **Sidebar: Skip the Layers**
>
> For apps under 5,000 lines of code, flat architecture beats layered architecture.
>
> ```typescript
> // features/users/create-user.ts
> import { db } from '../../shared/db';
> import { sendEmail } from '../../shared/email';
>
> export async function createUser(input: CreateUserInput) {
>   const user = await db.user.create({ data: input });
>   await sendEmail(user.email, 'Welcome!');
>   return user;
> }
> ```
>
> No repository. No service layer. No DI container. Just a function that does the work.
>
> **When to add layers:**
> - When you have 3+ consumers of the same logic (HTTP, CLI, worker)
> - When you need to unit test without a database
> - When you genuinely plan to swap databases or email providers

### When to Choose Which?

| Factor | Layered Architecture | Flat Architecture |
|--------|---------------------|-------------------|
| Team size | Large (> 10 engineers) | Small (< 10 engineers) |
| Codebase size | > 10,000 lines | < 10,000 lines |
| Test strategy | Heavy unit testing | Integration testing |
| Cross-cutting concerns | Centralized (middleware) | Per-feature |
| Scaling pattern | Horizontal (add more layers) | Vertical (add more features) |

**The rule:** Start flat. Add layers only when the flat structure becomes painful.

---

## 18. Mini Project: Refactor Task API

### Goal

Take a typical "fat controller" Task API and refactor it using:
- Repository Pattern
- Service Layer
- Dependency Injection
- Background Jobs (BullMQ)
- Event Bus

### Before (The Mess)

```javascript
// routes/tasks.js — 200 lines of everything
app.get('/tasks', authenticate, async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks);
});

app.post('/tasks', authenticate, async (req, res) => {
  const task = await prisma.task.create({
    data: {
      title: req.body.title,
      description: req.body.description,
      userId: req.user.id,
      status: 'pending',
    },
  });
  
  await sendEmail(req.user.email, `Task created: ${task.title}`);
  
  res.status(201).json(task);
});
```

### After (The Architecture)

```
src/
├── config/
│   └── container.ts          # DI composition root
├── domain/
│   ├── events/
│   │   └── task.events.ts
│   └── errors/
│       └── domain.errors.ts
├── repositories/
│   ├── interfaces/
│   │   └── task.repository.interface.ts
│   └── prisma/
│       └── prisma-task.repository.ts
├── services/
│   ├── interfaces/
│   │   └── email.service.interface.ts
│   ├── task.service.ts
│   └── email.service.ts
├── controllers/
│   └── task.controller.ts
├── queues/
│   └── email.queue.ts
└── routes/
    └── task.routes.ts
```

**Composition Root:**

```typescript
// config/container.ts
import { PrismaClient } from '@prisma/client';
import { PrismaTaskRepository } from '../repositories/prisma/prisma-task.repository';
import { TaskService } from '../services/task.service';
import { TaskController } from '../controllers/task.controller';
import { SendGridEmailService } from '../services/email.service';
import { EmailQueue } from '../queues/email.queue';

export function createApp() {
  const prisma = new PrismaClient();
  
  // Repositories
  const taskRepository = new PrismaTaskRepository(prisma);
  
  // Services
  const emailService = new SendGridEmailService(process.env.SENDGRID_KEY);
  const emailQueue = new EmailQueue();
  
  const taskService = new TaskService({
    taskRepository,
    emailQueue,
  });
  
  // Controllers
  const taskController = new TaskController(taskService);
  
  return { app: buildExpressApp(taskController) };
}
```

**Service Layer:**

```typescript
// services/task.service.ts
export class TaskService {
  constructor(
    private taskRepository: TaskRepository,
    private emailQueue: EmailQueue,
  ) {}
  
  async createTask(input: CreateTaskInput): Promise<Task> {
    // Business validation
    if (input.title.length < 3) {
      throw new ValidationError('Title must be at least 3 characters');
    }
    
    // Create task
    const task = await this.taskRepository.create({
      title: input.title,
      description: input.description,
      userId: input.userId,
      status: 'pending',
      createdAt: new Date(),
    });
    
    // Emit event (async, via queue)
    await this.emailQueue.add('task-created', {
      userId: input.userId,
      taskTitle: task.title,
    });
    
    return task;
  }
  
  async getUserTasks(userId: string, pagination: PaginationInput) {
    return this.taskRepository.findByUserId(userId, pagination);
  }
  
  async completeTask(taskId: string, userId: string) {
    const task = await this.taskRepository.findById(taskId);
    
    if (!task) throw new NotFoundError('Task not found');
    if (task.userId !== userId) throw new ForbiddenError('Not your task');
    if (task.status === 'completed') {
      throw new ValidationError('Task already completed');
    }
    
    return this.taskRepository.update(taskId, {
      status: 'completed',
      completedAt: new Date(),
    });
  }
}
```

**Controller:**

```typescript
// controllers/task.controller.ts
export class TaskController {
  constructor(private taskService: TaskService) {}
  
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await this.taskService.createTask({
        title: req.body.title,
        description: req.body.description,
        userId: req.user.id,
      });
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  };
  
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tasks = await this.taskService.getUserTasks(
        req.user.id,
        { cursor: req.query.cursor, limit: Number(req.query.limit) || 20 }
      );
      res.json(tasks);
    } catch (err) {
      next(err);
    }
  };
}
```

**Test (Pure Unit Test):**

```typescript
// services/task.service.test.ts
describe('TaskService', () => {
  it('should create a task and queue email', async () => {
    const mockRepo = {
      create: vi.fn().mockResolvedValue({ id: '1', title: 'Test' }),
    };
    const mockQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };
    
    const service = new TaskService(mockRepo, mockQueue);
    const result = await service.createTask({
      title: 'Test',
      description: 'Description',
      userId: 'user-1',
    });
    
    expect(result.title).toBe('Test');
    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledWith('task-created', expect.any(Object));
  });
  
  it('should reject short titles', async () => {
    const service = new TaskService({}, {});
    
    await expect(service.createTask({
      title: 'A',
      description: '',
      userId: 'user-1',
    })).rejects.toThrow(ValidationError);
  });
});
```

---

## Key Takeaways

| Pattern | Problem It Solves | Without It |
|---------|-------------------|------------|
| **DI** | Untestable code | Singletons, shared state, slow tests |
| **Repository** | Query logic scattered | N+1 queries, SQL in controllers |
| **Service Layer** | Business logic trapped in HTTP | Fat controllers, no reuse |
| **Factory** | Hard-coded dependencies | Cannot swap implementations |
| **Observer** | Tight coupling to side effects | 3-second responses, cascade failures |
| **CQRS** | Read/write conflicts | Slow writes, slow reads, timeouts |
| **Event Sourcing** | Lost audit history | "We don't know what happened" |
| **Circuit Breaker** | Cascade failures | Total outage from one slow service |
| **Bulkhead** | Resource starvation | One service exhausts all connections |
| **Rate Limiting** | Abuse/overload | DDoS, bill shock, data corruption |
| **Background Jobs** | Slow response times | Users wait, timeouts, no retries |
| **Streaming** | OOM crashes | Server crashes on large uploads |
| **Cursor Pagination** | Offset timeouts | 10-second page loads, timeouts |

> **Architecture is about postponing decisions** — these patterns let you change databases, email providers, and scaling strategies without rewriting your business logic.
