# Module 08: Microservices - When to Split and When to Regret It

> *"Microservices are not a goal. They are a price you pay for scale."*

---

## Table of Contents

1. [Monolith vs Microservices: The Trade-Off](#1-monolith-vs-microservices-the-trade-off)
2. [Modular Monolith: The Permanent Valid Architecture](#2-modular-monolith-the-permanent-valid-architecture)
3. [Why Start with a Monolith](#3-why-start-with-a-monolith)
4. [When to Actually Split](#4-when-to-actually-split)
5. [Communication Patterns](#5-communication-patterns)
6. [Service Discovery](#6-service-discovery)
7. [API Gateway Pattern](#7-api-gateway-pattern)
8. [Database Per Service](#8-database-per-service)
9. [Distributed Transactions](#9-distributed-transactions)
10. [When NOT to Use Microservices](#10-when-not-to-use-microservices)
11. [Mini Project](#11-mini-project-split-the-task-api)

---

## 1. Monolith vs Microservices: The Trade-Off

### WHAT is a monolith?

A monolith is a single codebase, single deployment unit, single database. All features — authentication, tasks, notifications, billing — live in one application.

```
┌─────────────────────────────────────────────┐
│              Task Management App            │
│  ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │  Auth    │ │ Tasks  │ │ Notifications│  │
│  └──────────┘ └────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │         PostgreSQL Database          │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### WHAT are microservices?

Microservices split the application into independently deployable services, each with its own codebase, database, and deployment lifecycle.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
│ Auth Service│  │Task Service │  │Notify Service   │
│   (Port     │  │  (Port      │  │    (Port        │
│    3001)    │  │   3002)     │  │     3003)       │
└──────┬──────┘  └──────┬──────┘  └────────┬────────┘
       │                │                   │
┌──────▼──────┐  ┌──────▼──────┐  ┌────────▼────────┐
│Auth DB      │  │Task DB      │  │Notify Queue     │
│(PostgreSQL) │  │(PostgreSQL) │  │(Redis/RabbitMQ) │
└─────────────┘  └─────────────┘  └─────────────────┘
```

### WHY does the choice matter?

Because the wrong choice at the wrong time kills companies.

**Monolith advantages:**
- Simple to develop: one repo, one test suite, one deployment
- Simple to debug: stack traces span the entire request
- Simple to operate: one process, one database, one backup strategy
- Fast transactions: ACID guarantees across all features
- No network overhead: function calls, not HTTP requests

**Microservices advantages:**
- Independent deployment: deploy Auth without touching Tasks
- Independent scaling: scale Task Service 10x without scaling Auth
- Technology diversity: use Rust for CPU-heavy tasks, Node.js for APIs
- Team autonomy: separate teams own separate services
- Fault isolation: if Notifications is down, Tasks still works

### WHAT HAPPENS if you choose wrong?

**Microservices too early:**
A 5-person startup split into 12 microservices. Every feature required changes to 4 services, 4 pull requests, 4 code reviews, and coordinated deployments. Development velocity dropped by 70%. They spent more time on infrastructure than product.

**Monolith too late:**
A 500-engineer company kept a single monolith. Deployments required 6 hours of coordination. A single bad commit took down the entire platform. They couldn't scale teams because everyone stepped on each other's code.

### The Decision Framework

| Factor | Monolith | Microservices |
|--------|----------|---------------|
| Team size | <25 engineers | >50 engineers |
| Deployment frequency | Daily | Multiple times/day per service |
| Scale needs | Uniform (everything scales together) | Heterogeneous (one feature needs 10x) |
| Failure isolation | Acceptable downtime | Zero tolerance for cascading failures |
| Coordination cost | Low | High |
| Transaction complexity | Simple ACID | Distributed sagas |

---

## 2. Modular Monolith: The Permanent Valid Architecture

### WHAT Is a Modular Monolith?

A modular monolith is a single deployable unit with **clear internal module boundaries**. You get the simplicity of a monolith with the organizational clarity of microservices.

```
┌─────────────────────────────────────────────┐
│              Task Management App            │
│  ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │  Auth    │ │ Tasks  │ │ Notifications│  │
│  │  Module  │ │ Module │ │   Module     │  │
│  │          │ │        │ │              │  │
│  │ Internal │ │ Internal│ │  Internal    │  │
│  │   API    │ │  API   │ │    API       │  │
│  └────┬─────┘ └───┬────┘ └──────┬───────┘  │
│       └───────────┴─────────────┘           │
│              Shared Kernel                   │
│  ┌──────────────────────────────────────┐  │
│  │         PostgreSQL Database          │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### WHY Modular Monolith?

1. **Single deployment:** One `git push`, one build, one deploy
2. **Clear boundaries:** Modules communicate through defined interfaces (not direct DB access)
3. **Future extraction:** When a module needs independent scaling, extract it — the interface is already defined
4. **No network overhead:** Module calls are function calls, not HTTP requests
5. **Atomic transactions:** ACID across modules is trivial

### Successful Monoliths (That Stayed Monoliths)

**Shopify:** Started as a Rails monolith in 2006. Still primarily a monolith today with carefully extracted services. Handles $200B+ in GMV annually with 10,000+ engineers.

**Basecamp:** David Heinemeier Hansson (creator of Rails) famously advocates for monoliths. Basecamp runs on a single Rails codebase with millions of users.

**Etsy:** Started as a PHP monolith. Migrated to a service-oriented architecture over *years*, not months. Most core commerce remains monolithic.

**Instagram:** Single Django monolith for years after Facebook acquisition. Only extracted services when specific scaling needs emerged.

**GitHub:** Primarily a Ruby on Rails monolith. Microservices were introduced selectively for specific domains.

### The Lesson

> "Microservices are not a goal. They are a price you pay for scale."
>
> If you don't have the scaling problem, don't pay the price.

---

## 3. Why Start with a Monolith

### WHAT is monolith-first?

Build a single application. Learn the domain. Understand the boundaries. Only split when the pain of the monolith exceeds the pain of microservices.

### The Hidden Cost of Premature Microservices

```
Before microservices:          After premature microservices:
┌─────────────┐               ┌─────┐ ┌─────┐ ┌─────┐
│   git push  │               │ svc │ │ svc │ │ svc │
│   deploy    │               │  A  │ │  B  │ │  C  │
└─────────────┘               └──┬──┘ └──┬──┘ └──┬──┘
                                 └───────┼───────┘
                                    CI/CD choreography
                                    Shared library versioning
                                    Cross-service integration tests
                                    Distributed tracing setup
                                    Service mesh configuration
```

### WHAT HAPPENS if you microservice too early?

**Complexity death:**
A team of 4 engineers created 8 microservices. They spent:
- 30% of time on service-to-service communication
- 20% on deployment orchestration
- 15% on debugging distributed bugs
- 10% on database schema synchronization across services

That left **25% for actual product development.** The startup ran out of runway.

### LATEST Best Practices (2025)

- **Modular monolith:** Organize your monolith into clear modules (Auth, Tasks, Billing) with internal APIs. This makes future extraction trivial.
- **Domain-Driven Design (DDD):** Use bounded contexts to define module boundaries. When a bounded context needs independent deployment, extract it.
- **The Rule of Three:** Don't consider splitting until you have 3 teams that need to deploy independently.

---

## 4. When to Actually Split

### WHAT are the real signals?

1. **Team size:** >50 engineers working on one codebase. Merge conflicts become daily battles.
2. **Deployment independence:** One team needs to deploy 10x/day; another needs stability.
3. **Different scaling needs:** Tasks API gets 10,000 RPS; Admin API gets 10 RPS.
4. **Different reliability needs:** Auth must have 99.99% uptime; Analytics can tolerate 99%.
5. **Technology mismatch:** Image processing needs FFmpeg/GPU; the API needs Node.js.
6. **Regulatory boundaries:** EU data must stay in EU; US data in US.

### The Extraction Strategy

Don't rewrite. Extract.

```
Step 1: Modular monolith
┌────────────────────────────────┐
│ Monolith                       │
│  [Auth Module] [Tasks Module]  │
└────────────────────────────────┘

Step 2: Internal API
┌────────────────────────────────┐
│ Monolith                       │
│  [Auth Module]→[Tasks Module]  │
│   (internal HTTP call)         │
└────────────────────────────────┘

Step 3: Extract service
┌─────────────┐  ┌─────────────┐
│ Auth Service│  │Task Module  │
│  (external) │  │ (monolith)  │
└─────────────┘  └─────────────┘
```

### WHAT HAPPENS if you split wrong?

**The distributed monolith:**
A team split into microservices but kept a shared database. Now deployments required coordinated schema migrations across 5 services. They had all the pain of microservices (network calls, distributed debugging) with none of the benefits (independent deployment).

**The chatty services:**
Services called each other in a chain: API Gateway → Auth → User → Permissions → Auth → API Gateway. A single request triggered 12 network calls. Latency went from 20ms to 800ms.

---

## 4. Communication Patterns

### Synchronous: HTTP/REST Between Services

```javascript
// Task Service calls Auth Service
const axios = require('axios');

async function getUserFromAuthService(token) {
  const response = await axios.get('http://auth-service:3001/users/me', {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5000,
  });
  return response.data;
}
```

**Pros:**
- Simple to understand
- Immediate feedback (success or failure)
- Easy to debug

**Cons:**
- Tight coupling: if Auth is down, Tasks is down
- Latency stacks: 5 services × 50ms = 250ms minimum
- Cascading failures: one slow service slows everything

### Asynchronous: Message Queues

```javascript
// Task Service publishes event
const { Queue } = require('bull');
const notificationQueue = new Queue('notifications', {
  redis: { host: 'redis', port: 6379 }
});

async function createTask(taskData) {
  const task = await db.tasks.create(taskData);
  await notificationQueue.add('task-created', {
    userId: task.assignedTo,
    taskId: task.id,
    title: task.title,
  });
  return task;
}
```

```javascript
// Notification Service consumes event
const { Queue } = require('bull');
const notificationQueue = new Queue('notifications', {
  redis: { host: 'redis', port: 6379 }
});

notificationQueue.process('task-created', async (job) => {
  const { userId, taskId, title } = job.data;
  await sendEmail(userId, `New task assigned: ${title}`);
});
```

**Message Queue Options:**

| Queue | Best For | Persistence | Complexity |
|-------|----------|-------------|------------|
| **Redis Pub/Sub** | Simple events, real-time | No (fire-and-forget) | Low |
| **Bull/BullMQ** (Redis-based) | Node.js job queues | Yes (Redis) | Low |
| **RabbitMQ** | Complex routing, AMQP | Yes (disk) | Medium |
| **Apache Kafka** | High throughput, event sourcing | Yes (disk, replicated) | High |
| **AWS SQS** | AWS-native, managed | Yes (14 days) | Low |

### WHY async prevents cascading failures

**The synchronous cascade:**
```
Client → API Gateway → Auth Service (slow, 10s timeout)
                              ↓
                         Task Service (waits 10s)
                              ↓
                         Client timeout (30s)
                              ↓
                         Retry storm → total collapse
```

**The asynchronous resilience:**
```
Client → API Gateway → Task Service → Queue (immediate ack)
                                              ↓
                                    Notification Service (processes when ready)
```

If the Notification Service is down, tasks still get created. Messages queue up and are processed when the service recovers.

### WHAT HAPPENS with sync call chains?

**The Death Spiral of 2014:**
A major e-commerce platform had a synchronous chain: Frontend → Cart → Inventory → Pricing → Promotions → Tax. During a flash sale:
1. Inventory Service slowed to 2s responses
2. Cart Service threads blocked waiting for Inventory
3. Cart Service thread pool exhausted
4. Frontend couldn't add items to cart
5. Users hammered refresh
6. The entire platform went down for 45 minutes

**The fix:** Make Inventory check async. Add to cart immediately; validate inventory asynchronously before checkout.

### LATEST Best Practices (2025)

- **Default to async** for cross-service communication
- **Circuit breakers:** If Auth Service fails 5 times in 30 seconds, stop calling it for 60 seconds
- **Timeouts everywhere:** Every HTTP call must have a timeout (default: 5s)
- **Retries with backoff:** Retry failed calls with exponential backoff, but only for idempotent operations
- **Idempotency keys:** `Idempotency-Key: uuid` prevents duplicate processing on retries

```javascript
const axios = require('axios');
const CircuitBreaker = require('opossum');

const authBreaker = new CircuitBreaker(
  (token) => axios.get('http://auth-service:3001/verify', { headers: { Authorization: token } }),
  {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  }
);

authBreaker.fallback(() => ({ authenticated: false }));

// Usage
const user = await authBreaker.fire(req.headers.authorization);
```

---

## 5. Service Discovery

### WHAT is service discovery?

Service discovery is how services find each other. In a monolith, you call a function. In microservices, you need to know: *what IP and port is the Auth Service running on?*

### WHY hardcoded URLs break

```javascript
// WRONG: Hardcoded URL
const AUTH_URL = 'http://auth-service:3001';
```

This breaks when:
- You scale Auth Service to 3 instances (which one?)
- You move to Kubernetes (DNS names change)
- You deploy to a new region (IPs change)
- A node dies and the service moves to a new machine

### WHAT HAPPENS without service discovery?

**The IPocalypse:**
A team hardcoded service IPs in a config file. When they scaled up, new instances had different IPs. Requests still went to the old IPs. 40% of API calls failed for 2 hours until someone updated the config and redeployed every service.

### Service Discovery Solutions

**1. DNS-Based (Simplest)**
```
auth-service.internal → 10.0.1.5, 10.0.1.6, 10.0.1.7
```
Docker Compose and Kubernetes both provide internal DNS.

**2. Service Registry (Consul, etcd, Eureka)**
```javascript
// Service registers itself on startup
const consul = require('consul')({ host: 'consul' });

await consul.agent.service.register({
  name: 'task-service',
  id: 'task-service-1',
  tags: ['node', 'v1'],
  port: 3002,
  check: {
    http: 'http://localhost:3002/health',
    interval: '10s',
  },
});
```

**3. Load Balancer + Gateway**
```javascript
// API Gateway routes to services
const routes = {
  '/auth/*': 'http://auth-service',
  '/tasks/*': 'http://task-service',
  '/notifications/*': 'http://notify-service',
};
```

**4. Kubernetes DNS (Modern Standard)**
```javascript
// In Kubernetes, services get DNS automatically
const AUTH_URL = 'http://auth-service.default.svc.cluster.local';
```

### LATEST Best Practices (2025)

- Use **Kubernetes DNS** or **Docker Compose DNS** for containerized environments
- Use a **service mesh** (Istio, Linkerd) for advanced traffic management, mTLS, and observability
- Always access services through a **load balancer**, not individual instances
- Health checks must deregister unhealthy instances from discovery

---

## 6. API Gateway Pattern

### WHAT is an API Gateway?

An API Gateway is a single entry point for all clients. It routes requests to the appropriate microservice, handles cross-cutting concerns, and presents a unified API.

```
Client (Web)          Client (Mobile)
     │                      │
     └──────────┬───────────┘
                │
         ┌──────▼──────┐
         │ API Gateway │
         │  (Port 443) │
         └──────┬──────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼───┐  ┌───▼───┐  ┌───▼────┐
│ Auth  │  │ Tasks │  │ Notify │
└───────┘  └───────┘  └────────┘
```

### WHY every microservice needs one

**Without a gateway:**
```javascript
// Mobile app needs to call 4 services
GET https://auth.example.com/users/me
GET https://tasks.example.com/tasks?userId=123
GET https://billing.example.com/subscriptions/123
GET https://notifications.example.com/settings/123
```

**With a gateway:**
```javascript
// Mobile app calls 1 endpoint
GET https://api.example.com/dashboard
// Gateway calls 4 services internally and aggregates
```

**Responsibilities of a gateway:**
- **Authentication:** Verify JWT tokens for all routes
- **Rate limiting:** 100 requests/minute per API key
- **SSL termination:** HTTPS in, HTTP to services
- **Request routing:** `/auth/*` → Auth Service
- **Response aggregation:** Combine data from multiple services
- **Caching:** Cache `GET /users/me` for 30 seconds
- **Protocol translation:** GraphQL → REST, gRPC → HTTP

### WHAT HAPPENS without a gateway?

**Authentication spaghetti:**
Every microservice implemented its own JWT validation. One service had a bug that accepted expired tokens. An attacker exploited it for 6 months before discovery.

**Client complexity:**
The mobile app had to handle 8 different base URLs, 8 different error formats, and 8 different authentication mechanisms. The iOS team threatened to quit.

### LATEST Best Practices (2025)

Popular API Gateways:
- **Kong:** Open-source, plugin ecosystem, battle-tested
- **NGINX + Lua:** Lightweight, custom logic
- **AWS API Gateway:** Managed, scales infinitely
- **Envoy Proxy:** Cloud-native, service mesh integration
- **GraphQL Federation:** Aggregate multiple REST services behind a single GraphQL schema

**Warning:** Don't put business logic in the gateway. It's for cross-cutting concerns only.

---

## 7. Database Per Service

### WHAT is database-per-service?

Each microservice owns its own database. No service can access another service's database directly.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│Auth Service │     │Task Service │     │Notify Svc   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
│Auth DB      │     │Task DB      │     │Notify DB    │
│(PostgreSQL) │     │(PostgreSQL) │     │(MongoDB)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### WHY is shared database a distributed monolith?

**The shared database trap:**
```sql
-- Task Service directly queries Auth Service's users table
SELECT email FROM users WHERE id = $1;
```

This means:
1. Task Service is coupled to Auth Service's schema
2. Auth Service can't change its schema without breaking Task Service
3. Task Service needs credentials to Auth's database
4. You can't scale or migrate Auth's database independently

### WHAT HAPPENS with a shared database?

**The Schema Migration War:**
A team of 50 engineers shared one PostgreSQL database. A simple schema change required:
1. Coordinating with 8 teams
2. Finding a maintenance window (2 AM Sunday)
3. Running migrations that took 4 hours
4. Rolling back when one service broke

They deployed schema changes **twice per year**. Feature velocity died.

### LATEST Best Practices (2025)

- Each service owns its data. Other services access it through the service's API.
- Use **event sourcing** or **CQRS** for complex read patterns
- Choose the right database for the service:
  - Auth: PostgreSQL (ACID for user data)
  - Tasks: PostgreSQL (relational data)
  - Notifications: MongoDB (flexible schema for templates)
  - Analytics: ClickHouse (columnar for aggregations)
  - Cache: Redis (fast lookups)

---

## 8. Distributed Transactions

### WHAT is the problem?

In a monolith, this is atomic:
```javascript
await db.transaction(async (trx) => {
  await trx('users').update({ balance: balance - 100 }).where('id', userId);
  await trx('orders').insert({ userId, amount: 100, status: 'paid' });
});
// Both succeed or both fail
```

In microservices, you can't wrap HTTP calls in a database transaction:
```javascript
// NOT ATOMIC!
await billingService.charge(userId, 100);  // Succeeds
await taskService.create({ userId, title: 'Premium Task' });  // Fails!
// User was charged but task not created
```

### The Saga Pattern

A saga is a sequence of local transactions where each service performs its own transaction and publishes an event. If a step fails, compensating transactions undo previous steps.

**Choreography Saga (Event-driven):**
```
Order Service          Billing Service          Task Service
     │                       │                       │
     │─ OrderCreatedEvent ──>│                       │
     │                       │─ PaymentChargedEvent─>│
     │                       │                       │─ TaskCreatedEvent─>
     │                       │                       │
     │<─ PaymentFailedEvent─│                       │ (compensate: refund)
```

**Orchestration Saga (Central coordinator):**
```
                    ┌─────────────────┐
                    │ Saga Orchestrator│
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐    ┌───────▼──────┐    ┌───────▼──────┐
│Order Service │    │Billing Svc   │    │Task Service  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Example: Compensating Transactions

```javascript
// Saga Orchestrator (Node.js)
class CreateTaskSaga {
  async execute(userId, taskData) {
    const sagaId = uuid();
    const steps = [];

    try {
      // Step 1: Check user exists (Auth Service)
      const user = await authService.getUser(userId);
      steps.push({ service: 'auth', action: 'verify' });

      // Step 2: Charge user (Billing Service)
      const payment = await billingService.charge(userId, 5.00, sagaId);
      steps.push({ service: 'billing', action: 'charge', id: payment.id });

      // Step 3: Create task (Task Service)
      const task = await taskService.create(userId, taskData);
      steps.push({ service: 'task', action: 'create', id: task.id });

      // Step 4: Send notification (Notify Service)
      await notifyService.sendTaskCreated(user.email, task);
      steps.push({ service: 'notify', action: 'send' });

      return { success: true, task };
    } catch (error) {
      // Compensate: undo all previous steps
      await this.compensate(steps);
      throw error;
    }
  }

  async compensate(steps) {
    for (const step of steps.reverse()) {
      if (step.service === 'billing' && step.action === 'charge') {
        await billingService.refund(step.id);
      }
      if (step.service === 'task' && step.action === 'create') {
        await taskService.delete(step.id);
      }
    }
  }
}
```

### WHAT HAPPENS without distributed transaction handling?

**The Double-Charge Bug:**
A billing service charged a user's credit card. The task creation failed due to a network timeout. The user was charged $50 but had no task. Support tickets flooded in. The company had to manually refund 200 users.

**The Orphaned Data:**
A user deletion saga deleted the user from Auth Service but failed to delete their tasks. Tasks existed with `userId` pointing to non-existent users. Analytics reports broke. GDPR compliance failed.

### LATEST Best Practices (2025)

- **Prefer async sagas** over synchronous distributed transactions
- **Idempotency keys:** Every operation must be idempotent (`sagaId`)
- **Outbox pattern:** Write events to an "outbox" table in the same DB transaction, then publish them asynchronously
- **Saga audit logs:** Log every saga step for debugging
- **Use Temporal or Camunda** for complex orchestration workflows

---

## 9. When NOT to Use Microservices

### The Anti-Patterns

**1. You have fewer than 3 teams**

If one team owns all the services, you're not getting organizational autonomy — you're just adding deployment complexity.

> **Rule of Three:** Don't consider microservices until you have 3+ teams that need to deploy independently.

**2. You don't know your domain boundaries**

Splitting along wrong boundaries creates "distributed monoliths" — all the pain of microservices with none of the benefits.

```
WRONG: Split by technical layer
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  API Layer  │  │  Business   │  │    Data     │
│  Service    │  │   Service   │  │   Service   │
└─────────────┘  └─────────────┘  └─────────────┘
     │                   │                │
     └───────────────────┴────────────────┘
           Chained synchronous calls

RIGHT: Split by business capability
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Orders    │  │  Inventory  │  │   Shipping  │
│   Service   │  │   Service   │  │   Service   │
└─────────────┘  └─────────────┘  └─────────────┘
```

**3. You need distributed transactions for everything**

If every user action requires 4 services to coordinate synchronously, you have a distributed monolith. Distributed transactions (sagas) are complex and error-prone.

**4. Your team lacks operational expertise**

Microservices require:
- Distributed tracing (Jaeger, Zipkin)
- Centralized logging (ELK, Grafana Loki)
- Service mesh or API gateway
- Automated deployment pipelines per service
- On-call rotation for each service

Without these, debugging production issues becomes impossible.

**5. You're optimizing for a scale you don't have**

A single Node.js process can handle 5,000-10,000 requests/second. PostgreSQL on a $40/month VPS can handle millions of rows. Don't optimize for 1M users when you have 1,000.

### The Decision Checklist

Before splitting to microservices, ask:

- [ ] Do we have 3+ independent teams?
- [ ] Is one service failing and taking down everything else?
- [ ] Do different components have radically different scaling needs?
- [ ] Do we need to deploy one component 10x more often than others?
- [ ] Can our team operate distributed systems effectively?
- [ ] Have we tried a modular monolith first?

If you answer "no" to any of these, **stay monolithic**.

---

## 10. Mini Project: Split the Task API

### Goal

Split the monolithic Task Management API into three services with inter-service communication:
1. **Auth Service** (Port 3001) — Register, login, JWT tokens
2. **Task Service** (Port 3002) — CRUD tasks (requires authentication)
3. **Notification Service** (Port 3003) — Sends emails (async, event-driven)

### Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
┌──────▼──────┐
│API Gateway  │
│  (Port 443) │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
┌──▼───┐ ┌─▼────────┐
│Auth  │ │Task Svc  │
│SVC   │ │(Port 3002)│
│(3001)│ └────┬─────┘
└──────┘      │
              │ TaskCreatedEvent
              │ (Redis Pub/Sub)
              │
         ┌────▼─────┐
         │Notify Svc│
         │(Port 3003)│
         └──────────┘
```

### Step 1: Auth Service

```javascript
// auth-service/src/app.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

const users = new Map(); // In-memory for demo; use real DB in production

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now().toString(), email, passwordHash: hash };
  users.set(user.id, user);
  res.status(201).json({ id: user.id, email });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

app.get('/users/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    const user = users.get(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'auth' }));

app.listen(3001, () => console.log('Auth Service on port 3001'));
```

### Step 2: Task Service

```javascript
// task-service/src/app.js
const express = require('express');
const axios = require('axios');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

const tasks = new Map();

async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

  try {
    const response = await axios.get('http://auth-service:3001/users/me', {
      headers: { Authorization: auth },
      timeout: 5000,
    });
    req.user = response.data;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/tasks', authenticate, async (req, res) => {
  const task = {
    id: Date.now().toString(),
    userId: req.user.id,
    title: req.body.title,
    description: req.body.description,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  tasks.set(task.id, task);

  // Publish event for async processing
  await redis.publish('task-events', JSON.stringify({
    type: 'task.created',
    task,
    user: req.user,
  }));

  res.status(201).json(task);
});

app.get('/tasks', authenticate, (req, res) => {
  const userTasks = Array.from(tasks.values()).filter(t => t.userId === req.user.id);
  res.json(userTasks);
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'task' }));

app.listen(3002, () => console.log('Task Service on port 3002'));
```

### Step 3: Notification Service

```javascript
// notification-service/src/app.js
const express = require('express');
const { createClient } = require('redis');

const app = express();

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

const subscriber = redis.duplicate();
subscriber.connect();

subscriber.subscribe('task-events', (message) => {
  const event = JSON.parse(message);
  if (event.type === 'task.created') {
    console.log(`[EMAIL] To: ${event.user.email}`);
    console.log(`[EMAIL] Subject: New task created: ${event.task.title}`);
    // In production: send actual email via SendGrid/AWS SES
  }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'notification' }));

app.listen(3003, () => console.log('Notification Service on port 3003'));
```

### Step 4: Docker Compose

```yaml
version: '3.8'

services:
  auth-service:
    build: ./auth-service
    ports:
      - "3001:3001"
    environment:
      - JWT_SECRET=super-secret-key-change-in-production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 3s
      retries: 3

  task-service:
    build: ./task-service
    ports:
      - "3002:3002"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - auth-service
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 10s
      timeout: 3s
      retries: 3

  notification-service:
    build: ./notification-service
    ports:
      - "3003:3003"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 10s
      timeout: 3s
      retries: 3

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - auth-service
      - task-service
```

### Step 5: nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;

    location /auth {
        proxy_pass http://auth-service:3001;
        proxy_set_header Host $host;
    }

    location /tasks {
        proxy_pass http://task-service:3002;
        proxy_set_header Host $host;
    }
}
```

### Testing the Flow

```bash
# 1. Start everything
docker compose up --build

# 2. Register a user
curl -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret"}'

# 3. Login
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret"}'
# Returns: {"token":"eyJhbGciOiJIUzI1NiIs..."}

# 4. Create a task (token from step 3)
curl -X POST http://localhost/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"title":"Deploy microservices","description":"Write the docs"}'

# 5. Check notification service logs
docker compose logs notification-service
# Should see: [EMAIL] To: alice@example.com
```

### Acceptance Criteria

- [ ] Auth Service runs independently on port 3001
- [ ] Task Service validates JWT by calling Auth Service
- [ ] Task creation publishes an event to Redis
- [ ] Notification Service consumes the event asynchronously
- [ ] Notification Service can crash and restart without losing tasks
- [ ] Each service has its own `/health` endpoint
- [ ] Nginx routes `/auth` to Auth Service and `/tasks` to Task Service

---

## Key Takeaways

1. **Start with a monolith.** Shopify, Etsy, and Instagram did. Extract services only when you have clear pain.
2. **Microservices are a scaling tool, not a virtue.** They solve organizational and scaling problems, not coding problems.
3. **Default to async communication.** It prevents cascading failures and lets services recover independently.
4. **Hardcoded URLs break.** Use service discovery (DNS, Consul, Kubernetes) from day one.
5. **The API Gateway is mandatory.** Authentication, rate limiting, and routing belong at the edge.
6. **Database-per-service is non-negotiable.** Shared databases create distributed monoliths.
7. **Distributed transactions need sagas.** ACID doesn't exist across services. Plan for compensating transactions.
8. **Complexity death is real.** A team of 4 with 8 microservices has 0 microservices and 8 problems.
9. **The extraction strategy:** modular monolith → internal API → external service. Never rewrite from scratch.
10. **If you can't explain why you need a microservice, you don't need one.**

---

*Module 08 - Microservices. Latest patterns as of 2025.*
