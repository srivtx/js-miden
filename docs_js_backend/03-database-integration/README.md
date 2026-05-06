# Module 03: Database Integration - SQL, NoSQL & Everything Between

> **Learning Objective:** By the end of this module, you will understand how to choose, configure, and operate databases in production Express applications. You'll write schema-first code with Prisma, handle concurrent users safely with transactions, and prevent the performance disasters that kill startups.

---

## Table of Contents

1. [Why Databases Exist](#1-why-databases-exist)
2. [SQL vs NoSQL: The Decision Framework](#2-sql-vs-nosql-the-decision-framework)
3. [Setting Up PostgreSQL with Docker](#3-setting-up-postgresql-with-docker)
4. [Prisma: The Modern ORM](#4-prisma-the-modern-orm)
5. [Connection Pooling](#5-connection-pooling)
6. [Transactions: ACID Explained](#6-transactions-acid-explained)
7. [Seeding Data for Development](#7-seeding-data-for-development)
8. [The Disaster Scenarios](#8-the-disaster-scenarios)
9. [Mini Project: E-Commerce Product Catalog](#9-mini-project-e-commerce-product-catalog)
10. [Summary & Checklist](#10-summary--checklist)

---

## 1. Why Databases Exist

### WHAT Is a Database?

A database is a specialized software system designed to **store, retrieve, and manage structured data reliably and efficiently**. Unlike keeping data in memory (which vanishes when your server restarts) or flat files (which are painfully slow to query), databases provide:

- **Persistence:** Data survives server restarts, crashes, and deployments
- **Structured Querying:** Find "all orders from last month over $100" in milliseconds
- **Concurrent Access:** Handle thousands of users reading and writing simultaneously without corruption
- **Integrity Enforcement:** Prevent impossible states (e.g., an order without a customer)
- **Scalability:** Grow from hundreds to millions of records without rewriting your app

### WHY Do We Need Them?

Imagine building an e-commerce site that stores products in a JavaScript array:

```javascript
// server.js - The nightmare scenario
const products = [
  { id: 1, name: 'Laptop', stock: 5 },
  { id: 2, name: 'Mouse', stock: 100 }
];

app.post('/api/purchase', (req, res) => {
  const product = products.find(p => p.id === req.body.productId);
  if (product.stock > 0) {
    product.stock--;  // What if two requests hit this simultaneously?
    res.json({ success: true });
  }
});
```

This code has three fatal flaws:
1. **Data loss on restart:** The `products` array resets when you deploy
2. **Race conditions:** Two simultaneous purchases can both see `stock: 5`, both decrement, and you sell 2 items when only 1 exists
3. **No querying power:** Finding "all products under $50 in the Electronics category with 4+ star reviews" requires writing manual filter loops

### WHAT HAPPENS If You Do It Wrong?

**Real-world consequence:** In 2020, a startup building a ticketing platform used in-memory storage during their beta. On their launch day, a server restart caused by a memory leak wiped all pending orders. They lost $180,000 in revenue and every user's trust.

**The rule:** If your data matters, it belongs in a database.

---

## 2. SQL vs NoSQL: The Decision Framework

### WHAT Are They?

**SQL (Relational) Databases** store data in structured tables with predefined schemas. They use **ACID transactions** and support complex joins. Under the hood, PostgreSQL uses B-Trees for indexing and MVCC (Multi-Version Concurrency Control) for transaction isolation.

**NoSQL Databases** encompass multiple categories:
- **Document Stores** (MongoDB): JSON documents, flexible schema
- **Key-Value Stores** (Redis): O(1) lookups via hash tables
- **Wide-Column Stores** (Cassandra): LSM-tree based, optimized for write-heavy workloads
- **Graph Databases** (Neo4j): Native graph storage with index-free adjacency
- **Search Engines** (Elasticsearch): Inverted indices for full-text search

### WHY Choose One Over the Other?

| Factor | Choose SQL | Choose NoSQL |
|--------|-----------|--------------|
| **Data Structure** | Highly relational, normalized data | Unstructured/semi-structured, evolving schema |
| **Consistency Requirement** | Strong consistency required (financial, inventory) | Eventual consistency acceptable (social feeds, analytics) |
| **Query Complexity** | Complex JOINs, aggregations, reporting | Simple lookups, document retrieval |
| **Scaling Pattern** | Vertical scaling + read replicas | Horizontal sharding natively |
| **Transaction Scope** | Multi-document/row ACID transactions | Single-document or best-effort transactions |
| **Team Expertise** | Strong SQL knowledge | Rapid prototyping, flexible requirements |

### Real Scenarios

**Scenario 1: E-Commerce Platform (Choose SQL)**

An online store has customers, orders, products, categories, reviews, and inventory. These are deeply interconnected:
- An order belongs to a customer and contains multiple products
- Products belong to categories and have inventory counts
- Reviews link users to products

You need **referential integrity** (prevent orders for non-existent products), **complex reporting** (monthly revenue by category), and **transactional safety** (deduct inventory only when payment succeeds). PostgreSQL is the natural choice.

**Scenario 2: Real-Time Analytics Dashboard (Choose NoSQL)**

You're collecting 10,000 events per second from IoT sensors. You need to write fast and query recent aggregates. You rarely update old data, and perfect consistency across all nodes isn't critical. Cassandra or ClickHouse handles this workload better than PostgreSQL.

**Scenario 3: Content Management System (Hybrid Approach)**

Articles have flexible metadata (different authors use different fields), but user accounts and permissions are relational. The modern approach: PostgreSQL for users/permissions, Elasticsearch for article search, and Redis for caching popular content.

### WHAT HAPPENS If You Choose Wrong?

**Choosing SQL when NoSQL was better:**
- Schema migrations become bottlenecks in rapid iteration cycles
- Vertical scaling hits hardware limits; sharding SQL is complex and error-prone
- **Example:** A social media startup used PostgreSQL for user feeds with millions of followers. Feed generation required expensive JOINs that degraded performance. They eventually migrated to a hybrid model with Redis for hot feeds.

**Choosing NoSQL when SQL was better:**
- Data inconsistency issues in financial calculations (floating-point in BSON vs DECIMAL in SQL)
- Lack of JOINs forces application-level joins (N+1 queries at scale)
- **Example:** An e-commerce platform used MongoDB for orders. Implementing inventory deduplication and consistent order totals required complex application logic that PostgreSQL handles with a single transaction.

> **The Pragmatic Shortcut: SQLite for Prototyping**
>
> Not ready to run PostgreSQL in Docker? For learning, prototyping, and small tools, **SQLite** is perfectly valid.
>
> ```bash
> # No server, no Docker — just a file
> npm install better-sqlite3
> ```
>
> ```typescript
> import Database from 'better-sqlite3';
> const db = new Database('app.db');
> db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`);
> ```
>
> **When to use SQLite:** Local dev, CLI tools, embedded apps, tests, and prototypes.
> **When to switch:** Concurrent writes, multiple app servers, complex analytics, or when you need row-level security.

### The Real Answer: Polyglot Persistence

Modern Express backends rarely use a single database:
- **PostgreSQL** as the system of record (SSOT)
- **Redis** for caching and sessions
- **Elasticsearch** for search
- **ClickHouse/TimescaleDB** for analytics

```javascript
// Express middleware pattern for multiple data sources
async function getProductWithCache(req, res, next) {
  const { id } = req.params;
  
  // 1. Try Redis cache
  const cached = await redis.get(`product:${id}`);
  if (cached) return res.json(JSON.parse(cached));
  
  // 2. Fallback to PostgreSQL
  const product = await db.query('SELECT * FROM products WHERE id = $1', [id]);
  
  // 3. Populate cache
  await redis.setex(`product:${id}`, 3600, JSON.stringify(product));
  
  res.json(product);
}
```

---

## 3. Setting Up PostgreSQL with Docker

### WHY Docker?

Docker is the modern way to run PostgreSQL locally because it provides:
- **Consistency:** Every developer runs the exact same PostgreSQL version (16+)
- **Isolation:** Your local PostgreSQL doesn't conflict with system services
- **Reproducibility:** A new teammate runs `docker compose up` and has a working database in 30 seconds
- **Clean removal:** `docker compose down -v` removes everything when you're done

### WHAT You Need

Create a `docker-compose.yml` in your project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: myapp_postgres
    environment:
      POSTGRES_USER: devuser
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: myapp_development
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U devuser -d myapp_development"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: myapp_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Start it:

```bash
docker compose up -d

# Check health
docker compose ps

# Connect with psql
docker exec -it myapp_postgres psql -U devuser -d myapp_development

# View logs
docker compose logs -f postgres
```

### WHAT HAPPENS If You Skip Docker?

Without Docker, you face:
- **Version conflicts:** Developer A has PostgreSQL 13, Developer B has 14, production runs 16. Features break mysteriously.
- **Orphaned data:** Uninstalling PostgreSQL from your system often leaves data directories behind, consuming disk space
- **"Works on my machine":** The most expensive debugging phrase in software engineering

---

## 4. Prisma: The Modern ORM

### WHAT Is Prisma?

Prisma is a **schema-first ORM** (Object-Relational Mapping) for Node.js and TypeScript. Unlike older ORMs like Sequelize or TypeORM, Prisma separates your database schema from application code and generates a fully type-safe client.

**Key components:**
- **Prisma Schema:** Declares your data model in a `.prisma` file
- **Prisma Client:** Auto-generated, type-safe database client
- **Prisma Migrate:** Handles database schema migrations
- **Prisma Studio:** Visual database management tool

### WHY Prisma?

| Feature | Prisma | TypeORM | Sequelize |
|---------|--------|---------|-----------|
| Type Safety | Full (generated types) | Partial (decorators) | Weak (manual) |
| Migrations | Declarative, version-controlled | Imperative | Good |
| Query API | Fluent, chainable | Repository/QueryBuilder | Model methods |
| Performance | ~1.2x raw SQL | ~1.5x raw SQL | ~1.8x raw SQL |
| Active Dev | Very active (Prisma 6.x) | Slowing down | Stable, legacy |

### Installation

```bash
npm install prisma @prisma/client
npx prisma init
```

This creates:
- `prisma/schema.prisma` - Your database schema
- `.env` - Database connection string

### Schema Definition

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  // Relations
  profile   Profile?
  posts     Post[]
  orders    Order[]
  
  @@map("users")
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String?
  avatar String?
  
  userId Int    @unique @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("profiles")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  
  authorId  Int      @map("author_id")
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  
  @@map("posts")
}
```

### WHY Schema-First?

- **Single source of truth:** Your schema file is the contract between your app and database
- **Type safety:** The Prisma client is generated from this schema. If you rename a field, TypeScript catches every usage
- **Database agnostic:** Change `provider = "postgresql"` to `mysql` or `sqlite` (with caveats) and Prisma adapts

### WHAT HAPPENS If You Don't Use Schema-First?

With TypeORM's decorator approach:
```typescript
@Entity()
class User {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column()
  email: string;  // Is this unique? Nullable? Indexed? You can't tell without checking DB
}
```

The schema is scattered across TypeScript files, and types can drift from the actual database structure. With Prisma, `schema.prisma` is the unambiguous contract.

### Migrations: Why They Matter

### WHAT Is a Migration?

A migration is a version-controlled script that transforms your database schema from one state to another. Think of it as Git for your database structure.

**Without migrations:** You manually run `ALTER TABLE` commands on your database. You have no record of what changed, when, or why. Rolling back a bad change is guesswork.

**With migrations:** Every schema change is a file that can be reviewed, tested, and applied consistently across environments.

### Creating Migrations

```bash
# After modifying schema.prisma, create a migration
npx prisma migrate dev --name add_user_profile

# This:
# 1. Generates the SQL to transform the database
# 2. Creates a migration file in prisma/migrations/
# 3. Applies it to your development database
# 4. Regenerates the Prisma Client

# For production (CI/CD pipelines)
npx prisma migrate deploy
```

**Generated migration file:**
```sql
-- prisma/migrations/20240115120000_add_user_profile/migration.sql

-- CreateTable
CREATE TABLE "profiles" (
    "id" SERIAL NOT NULL,
    "bio" TEXT,
    "avatar" TEXT,
    "user_id" INTEGER NOT NULL,
    
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### WHAT HAPPENS If You Skip Migrations?

**The "Cowboy Coding" Disaster:**

```bash
# Developer A connects to production and runs:
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

# Developer B, not knowing about this, runs:
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);

# Result: Two phone columns, inconsistent data, broken application code
```

Without migrations:
- **Environments diverge:** Development, staging, and production have different schemas
- **No rollback:** A bad schema change requires manual, error-prone recovery
- **Team chaos:** Two developers make conflicting changes simultaneously

Prisma migrations solve this by treating schema changes like code changes: versioned, reviewable, and reproducible.

### CRUD Operations

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CREATE
const newUser = await prisma.user.create({
  data: {
    email: 'alice@example.com',
    name: 'Alice',
    profile: {
      create: {
        bio: 'Full-stack developer',
        avatar: 'https://example.com/avatar.jpg'
      }
    }
  }
});

// READ
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: { profile: true, posts: true }
});

// UPDATE
const updated = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'Alice Smith' }
});

// DELETE
await prisma.user.delete({
  where: { id: 1 }
});

// ADVANCED: Pagination + Filtering + Sorting
const users = await prisma.user.findMany({
  where: {
    email: { endsWith: '@example.com' },
    posts: { some: { published: true } }
  },
  orderBy: { createdAt: 'desc' },
  skip: 0,
  take: 10,
  include: {
    _count: { select: { posts: true } }
  }
});
```

### Relations: 1:1, 1:N, N:M with Real Examples

**One-to-One (1:1): User ↔ Profile**

```prisma
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  profile Profile? // One user has one profile (optional)
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String?
  userId Int    @unique  // Unique enforces 1:1
  user   User   @relation(fields: [userId], references: [id])
}
```

**One-to-Many (1:N): User → Posts**

```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[] // One user has many posts
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int    // Foreign key
  author   User   @relation(fields: [authorId], references: [id])
}
```

**Many-to-Many (N:M): Post ↔ Category**

```prisma
model Post {
  id         Int        @id @default(autoincrement())
  title      String
  categories Category[] // Implicit join table
}

model Category {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}
```

**Explicit Many-to-Many (with extra fields):**

```prisma
model Post {
  id            Int            @id @default(autoincrement())
  title         String
  postCategories PostCategory[]
}

model Category {
  id            Int            @id @default(autoincrement())
  name          String         @unique
  postCategories PostCategory[]
}

// Join table with metadata
model PostCategory {
  postId     Int
  categoryId Int
  assignedAt DateTime @default(now())
  assignedBy String   // Track who categorized this
  
  post     Post     @relation(fields: [postId], references: [id])
  category Category @relation(fields: [categoryId], references: [id])
  
  @@id([postId, categoryId])
}
```

### WHY Explicit Join Tables?

When you need metadata on the relationship itself (when was it created? by whom?), implicit many-to-many relations aren't enough. The explicit join table pattern is essential for audit trails and business logic.

### When to Drop to Raw SQL

### WHAT Is Raw SQL?

Despite Prisma's power, some operations are better expressed in SQL directly.

### WHY Drop to Raw SQL?

1. **Complex Analytics:** Window functions, CTEs, recursive queries
2. **Performance-Critical Paths:** Bulk operations, `COPY FROM`, upserts
3. **Database-Specific Features:** PostgreSQL `jsonb` operators, full-text search, PostGIS
4. **Dynamic Queries:** Complex filtering where query shape changes at runtime

### Examples

```typescript
// Recursive CTE for category trees
const categories = await prisma.$queryRaw`
  WITH RECURSIVE category_tree AS (
    SELECT id, name, parent_id, 0 as depth
    FROM categories WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, c.name, c.parent_id, ct.depth + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT * FROM category_tree WHERE depth <= 3
`;

// Full-text search with PostgreSQL
const results = await prisma.$queryRaw`
  SELECT id, title, content,
    ts_rank(to_tsvector('english', title || ' ' || content), 
            plainto_tsquery('english', ${searchQuery})) as rank
  FROM posts
  WHERE to_tsvector('english', title || ' ' || content) 
        @@ plainto_tsquery('english', ${searchQuery})
  ORDER BY rank DESC
  LIMIT 10
`;

// Bulk insert (much faster than individual creates)
await prisma.$executeRaw`
  INSERT INTO logs (level, message, created_at)
  VALUES 
    ${Prisma.join(
      logs.map(l => Prisma.sql`(${l.level}, ${l.message}, NOW())`)
    )}
`;
```

### WHAT HAPPENS If You Use ORM for Everything?

An ORM-generated query for "top 10 products by revenue this month with their categories and average review score" might generate 15+ queries. Raw SQL with proper JOINs does it in one. At scale, this difference is the difference between 200ms and 20ms response times.

**The 80/20 Rule:** Use ORM for 80% of CRUD operations. Drop to raw SQL for the 20% that needs optimization.

---

## 5. Drizzle ORM: The Code-First Alternative

### WHAT Is Drizzle?

Drizzle is a **code-first ORM** for TypeScript. Unlike Prisma's schema-first approach (where you define models in a `.prisma` file), Drizzle lets you define your schema in TypeScript code and generates SQL migrations from it.

### HOW Drizzle Differs from Prisma

| Feature | Prisma (Schema-First) | Drizzle (Code-First) |
|---------|----------------------|----------------------|
| Schema definition | `.prisma` DSL | TypeScript code |
| Type safety | Generated client | Inference from TS schema |
| SQL control | High (raw queries) | **Maximum** (SQL-like API) |
| Migrations | Declarative, auto-generated | SQL-like, version-controlled |
| Learning curve | Low | Medium |
| Performance | ~1.2x raw SQL | ~1.1x raw SQL |

### WHY Choose Drizzle?

1. **SQL lovers:** Drizzle's query API looks like SQL written in TypeScript
2. **Performance-critical:** Slightly faster than Prisma; closer to raw SQL
3. **Existing SQL schemas:** Easier to adopt when you already have a database
4. **Bundle size:** Smaller than Prisma's query engine

### Simple Drizzle Example

```typescript
// db/schema.ts
import { pgTable, serial, varchar, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  authorId: integer('author_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

```typescript
// db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

```typescript
// Queries look like SQL
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users, posts } from './db/schema';

// SELECT * FROM users WHERE email = 'alice@example.com'
const user = await db.select().from(users).where(eq(users.email, 'alice@example.com'));

// INSERT INTO posts (title, author_id) VALUES ('Hello', 1) RETURNING *
const newPost = await db.insert(posts).values({ title: 'Hello', authorId: 1 }).returning();

// Relations with typed joins
const result = await db.select().from(users).leftJoin(posts, eq(users.id, posts.authorId));
```

### When to Choose Which?

| Situation | Recommendation |
|-----------|---------------|
| New project, team new to SQL | **Prisma** — better DX, auto-generated client |
| Team loves SQL, needs max control | **Drizzle** — SQL-like API, minimal abstraction |
| Existing database, complex migrations | **Prisma** — migration engine is more mature |
| Edge/Serverless (Cloudflare, Vercel) | **Drizzle** — smaller bundle, no query engine binary |

> **Note:** Both are excellent. Prisma has better tooling (Studio, cloud). Drizzle has better SQL ergonomics. You can even use both: Prisma for migrations, Drizzle for queries.

---

## 6. Connection Pooling

### WHAT Is Connection Pooling?

A database connection involves:
1. **TCP Handshake:** ~1 RTT
2. **TLS Handshake:** ~2 RTTs (if enabled)
3. **Authentication:** ~1 RTT
4. **Backend Process Spawn:** PostgreSQL forks a backend process per connection (~2-5MB RAM)
5. **Query Execution:** Actual work
6. **Connection Teardown:** FIN packets

**Without pooling, every query pays this tax.**

A connection pool maintains a set of **warm connections** (already authenticated, ready to use).

### WHY It Matters

**Without connection pooling (Direct connections):**
```javascript
// BAD: Creating a new connection per request
app.get('/users', async (req, res) => {
  const client = new pg.Client({ connectionString });
  await client.connect();  // ~50-100ms overhead!
  const result = await client.query('SELECT * FROM users');
  await client.end();
  res.json(result.rows);
});
```

**With connection pooling:**
```javascript
// GOOD: Reuse connections
const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'appuser',
  password: 'secret',
  max: 20,        // Maximum connections in pool
  min: 5,         // Minimum connections to maintain
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

app.get('/users', async (req, res) => {
  const client = await pool.connect();  // ~0-1ms if connection available
  try {
    const result = await client.query('SELECT * FROM users');
    res.json(result.rows);
  } finally {
    client.release();  // Return to pool, don't close!
  }
});
```

### WHAT HAPPENS Without Connection Pooling?

**Scenario: Black Friday E-commerce Site**
- Database: PostgreSQL with `max_connections = 100`
- Application: 10 Node.js instances, no pooling

**Without Pooling:**
1. Each request opens a new connection
2. At 100 concurrent requests, database hits connection limit
3. Request 101 gets: `FATAL: sorry, too many clients already`
4. 500 errors cascade. Revenue loss: $50,000/minute.

**With Pooling (max: 10 per instance):**
1. 10 instances × 10 connections = 100 total connections
2. Requests wait in queue for available connection (acceptable latency)
3. System handles 10,000 concurrent requests with 100 connections

**Resource Costs:**
- PostgreSQL backend process: ~2-5MB RAM each
- 1000 connections = 2-5GB RAM just for connection overhead
- With pool of 20: 40-100MB overhead

### Prisma Connection Pooling

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool is automatically managed by Prisma's query engine
  // But you can configure it via connection string parameters:
  // postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
});

// Monitor pool health (Prisma 5.1+)
app.get('/health', async (req, res) => {
  const metrics = await prisma.$metrics.json();
  res.json({
    poolSize: metrics.counters.find(c => c.key === 'prisma_pool_connections_open')?.value,
    idleConnections: metrics.gauges.find(g => g.key === 'prisma_pool_connections_idle')?.value,
  });
});
```

### Pool Sizing Formula

Use this formula from PostgreSQL experts:

```
connections = ((core_count × 2) + effective_spindle_count)
```

For a 4-core server with SSD (effective_spindle_count ≈ 1):
- **Optimal pool size: 9 connections per instance**

**LATEST Best Practice (2025):** For serverless architectures (Lambda, Cloud Functions), use a connection pooler like PgBouncer or RDS Proxy, or use serverless-native databases like Neon or Supabase.

---

## 7. Transactions: ACID Explained

### WHAT Are ACID Transactions?

**Atomicity:** All operations succeed or none do. Implemented via WAL (Write-Ahead Logging) - changes are written to log before being applied.

**Consistency:** Database moves from one valid state to another. Enforced by constraints, triggers, and cascade rules.

**Isolation:** Concurrent transactions don't interfere. Implemented via locking (pessimistic) or MVCC (optimistic).

**Durability:** Committed data survives crashes. WAL is fsync'd to disk before commit acknowledgment.

### WHY Transactions Matter

Consider a bank transfer: Alice sends $100 to Bob.

Without a transaction:
```javascript
// DANGEROUS: Two separate queries
await db.query('UPDATE accounts SET balance = balance - 100 WHERE id = ?', [aliceId]);
// Server crashes here!
await db.query('UPDATE accounts SET balance = balance + 100 WHERE id = ?', [bobId]);
// Result: $100 vanished from Alice but never reached Bob
```

With a transaction:
```javascript
// SAFE: Atomic operation
await prisma.$transaction(async (tx) => {
  await tx.account.update({
    where: { id: aliceId },
    data: { balance: { decrement: 100 } }
  });
  
  await tx.account.update({
    where: { id: bobId },
    data: { balance: { increment: 100 } }
  });
  
  await tx.transaction.create({
    data: { fromId: aliceId, toId: bobId, amount: 100 }
  });
});
// Either all three operations succeed, or none do
```

### Isolation Levels

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Use Case |
|-------|-----------|---------------------|--------------|----------|
| READ UNCOMMITTED | Allowed | Allowed | Allowed | Rarely used |
| READ COMMITTED | Prevented | Allowed | Allowed | **Default.** Good balance |
| REPEATABLE READ | Prevented | Prevented | Allowed | Report generation |
| SERIALIZABLE | Prevented | Prevented | Prevented | Financial transactions |

**Dirty Read:** Transaction A reads uncommitted changes from Transaction B. If B rolls back, A read invalid data.

**Non-Repeatable Read:** Transaction A reads row X. Transaction B updates X and commits. A reads X again - different value.

**Phantom Read:** Transaction A reads rows matching WHERE clause. Transaction B inserts/deletes matching rows. A runs same query - different row set.

### Prisma Transactions

```typescript
// Interactive transactions (recommended for complex logic)
await prisma.$transaction(async (tx) => {
  // All queries inside use the same transaction
  const order = await tx.order.create({ data: { userId, status: 'pending' } });
  
  for (const item of cartItems) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } }
    });
    
    await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      }
    });
  }
  
  return order;
}, {
  isolationLevel: 'Serializable', // Optional: stricter isolation
  maxWait: 5000,  // Max time to acquire transaction
  timeout: 10000  // Max transaction duration
});
```

### WHAT HAPPENS If You Don't Use Transactions?

**The Inventory Oversell Disaster:**

```javascript
// BAD: No transaction, no locking
app.post('/api/purchase', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.body.productId }
  });
  
  if (product.stock < req.body.quantity) {
    return res.status(400).json({ error: 'Out of stock' });
  }
  
  // RACE CONDITION: Two requests can both pass the check simultaneously
  await prisma.product.update({
    where: { id: req.body.productId },
    data: { stock: { decrement: req.body.quantity } }
  });
  
  await prisma.order.create({ data: { ... } });
});
```

**Timeline of doom:**
1. Request A checks stock: 1 item remaining. ✓
2. Request B checks stock: 1 item remaining. ✓
3. Request A decrements stock: 0 remaining. ✓
4. Request B decrements stock: -1 remaining. ✓
5. Both create orders. You just sold 2 items when you only had 1.

**Fix with transaction + locking:**
```typescript
await prisma.$transaction(async (tx) => {
  // Lock the row for update (pessimistic locking)
  const product = await tx.$queryRaw`
    SELECT * FROM products WHERE id = ${productId} FOR UPDATE
  `;
  
  if (product[0].stock < quantity) {
    throw new Error('Out of stock');
  }
  
  await tx.product.update({
    where: { id: productId },
    data: { stock: { decrement: quantity } }
  });
  
  await tx.order.create({ data: { ... } });
});
```

### Deadlock Prevention

Deadlocks occur when two transactions wait for each other's locks. Prevention strategies:

1. **Consistent Lock Ordering:** Always acquire locks in the same order
```typescript
// GOOD: Always lock by ID ascending
const sortedItems = cartItems.sort((a, b) => a.productId - b.productId);
for (const item of sortedItems) {
  await tx.$queryRaw`SELECT * FROM products WHERE id = ${item.productId} FOR UPDATE`;
}
```

2. **Short Transactions:** Keep transactions as short as possible
3. **Retry Logic:** PostgreSQL returns error code `40P01` for deadlocks

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error.code === '40P01' && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

---

## 8. Seeding Data for Development

### WHAT Is Seeding?

Seeding is populating your development database with realistic test data so you can build and test features without manual data entry.

### WHY Seed Data?

- **Realistic testing:** Pagination looks different with 3 records vs 300
- **Consistent state:** Every developer starts with the same dataset
- **Demo ready:** Staging environments have compelling data for stakeholders
- **Integration testing:** E2E tests rely on predictable data existing

### Prisma Seeding

```bash
npm install -D @faker-js/faker
```

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Create categories
  const electronics = await prisma.category.create({
    data: { name: 'Electronics', slug: 'electronics' }
  });
  
  const clothing = await prisma.category.create({
    data: { name: 'Clothing', slug: 'clothing' }
  });

  // Create products with reviews
  for (let i = 0; i < 50; i++) {
    const product = await prisma.product.create({
      data: {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price({ min: 10, max: 1000 })),
        stock: faker.number.int({ min: 0, max: 100 }),
        categoryId: i % 2 === 0 ? electronics.id : clothing.id,
        reviews: {
          create: Array.from({ length: faker.number.int({ min: 0, max: 10 }) }, () => ({
            rating: faker.number.int({ min: 1, max: 5 }),
            comment: faker.lorem.paragraph(),
            authorName: faker.person.fullName()
          }))
        }
      }
    });
  }

  console.log('Seeded 50 products with reviews');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

```json
// package.json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Run it:
```bash
npx prisma db seed
```

---

## 9. The Disaster Scenarios

### Scenario 1: What Happens If You Don't Use Transactions

**The Partial Order Problem:**

A user clicks "Place Order." Your code:
1. Creates the order record
2. Deducts inventory
3. Charges the payment method
4. Sends confirmation email

Without a transaction, if step 3 fails:
- The order exists
- Inventory was deducted
- But no payment was processed
- Customer support nightmare

**Real-world impact:** A major retailer lost $2.3M in a quarter due to partial order processing. Customers received items they never paid for, while others paid for items that were never shipped.

**The Fix:**
```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ ... });
  await tx.inventory.update({ ... });
  await tx.payment.create({ ... }); // If this throws, everything rolls back
  // Email sent AFTER transaction commits (out of band)
});
```

### Scenario 2: What Happens If You Use N+1 Queries

**The N+1 Problem:**

You fetch a list of posts, then for each post, you fetch its author:

```typescript
// BAD: N+1 queries
const posts = await prisma.post.findMany({ take: 100 });
// Query 1: SELECT * FROM posts LIMIT 100

for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });
  // Queries 2-101: SELECT * FROM users WHERE id = ? (×100)
}
// Total: 101 queries for 100 posts
```

At 100 posts: 101 queries. At 1000 posts: 1001 queries. Under load, your database dies.

**Real-world impact:** A blogging platform with N+1 queries in their feed endpoint experienced 8-second response times. Their PostgreSQL CPU hit 100% with just 50 concurrent users. After fixing with `include`, response times dropped to 120ms.

**The Fix:**
```typescript
// GOOD: Single query with JOIN
const posts = await prisma.post.findMany({
  take: 100,
  include: {
    author: {
      select: { id: true, name: true, email: true }
    }
  }
});
// Single query with JOIN: SELECT ... FROM posts JOIN users ON ... LIMIT 100
```

**Prisma's `include` generates a JOIN. Use it.**

### Latest Best Practices (Prisma 6.x, PostgreSQL 16+)

1. **Use relation queries efficiently:**
   ```typescript
   // Prisma 5.13+ optimized relation counts
   const users = await prisma.user.findMany({
     include: {
       _count: { select: { posts: true } }
     }
   });
   ```

2. **Use `select` to limit fetched fields:**
   ```typescript
   // Only fetch what you need
   const users = await prisma.user.findMany({
     select: { id: true, email: true },
     take: 10
   });
   ```

3. **Enable query logging in development:**
   ```typescript
   const prisma = new PrismaClient({
     log: ['query', 'info', 'warn', 'error']
   });
   ```

4. **Use PostgreSQL 16 features:**
   - `pgvector` extension for AI/ML workloads
   - Improved JSONB performance
   - Logical replication enhancements for read replicas

---

## 10. Mini Project: E-Commerce Product Catalog

### Project Requirements

Build an Express API for an e-commerce product catalog with:
- Categories (hierarchical)
- Products (with inventory tracking)
- Reviews (linked to products)
- Proper relations, transactions, and error handling

### Step 1: Schema Design

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Category {
  id          Int       @id @default(autoincrement())
  name        String    @unique
  slug        String    @unique
  description String?
  parentId    Int?      @map("parent_id")
  parent      Category? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryHierarchy")
  products    Product[]
  
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  @@map("categories")
}

model Product {
  id          Int         @id @default(autoincrement())
  sku         String      @unique
  name        String
  description String?
  price       Decimal     @db.Decimal(10, 2)
  stock       Int         @default(0)
  categoryId  Int         @map("category_id")
  category    Category    @relation(fields: [categoryId], references: [id])
  reviews     Review[]
  
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  
  @@index([categoryId])
  @@index([price])
  @@map("products")
}

model Review {
  id        Int      @id @default(autoincrement())
  rating    Int      // 1-5
  comment   String?
  authorName String  @map("author_name")
  productId Int      @map("product_id")
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@index([productId])
  @@map("reviews")
}
```

### Step 2: Environment Setup

```bash
# .env
DATABASE_URL="postgresql://devuser:devpassword@localhost:5432/ecommerce_dev"
```

```bash
npx prisma migrate dev --name init_ecommerce
npx prisma db seed
```

### Step 3: Express API with Prisma

```typescript
// src/index.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// GET /api/products - List products with filters
app.get('/api/products', async (req, res) => {
  const { category, minPrice, maxPrice, page = '1', limit = '20' } = req.query;
  
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);
  
  const where: any = {};
  
  if (category) {
    where.category = { slug: category };
  }
  
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice as string);
    if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
  }
  
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      include: {
        category: { select: { name: true, slug: true } },
        _count: { select: { reviews: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.product.count({ where })
  ]);
  
  res.json({
    data: products,
    meta: {
      total,
      page: parseInt(page as string),
      limit: take,
      totalPages: Math.ceil(total / take)
    }
  });
});

// GET /api/products/:slug - Get single product with reviews
app.get('/api/products/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      category: true,
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      _count: { select: { reviews: true } }
    }
  });
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  // Calculate average rating
  const avgRating = product.reviews.length > 0
    ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
    : null;
  
  res.json({ ...product, avgRating });
});

// POST /api/products/:id/reviews - Add review (in transaction)
app.post('/api/products/:id/reviews', async (req, res) => {
  const { rating, comment, authorName } = req.body;
  
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be 1-5' });
  }
  
  try {
    const review = await prisma.$transaction(async (tx) => {
      // Verify product exists
      const product = await tx.product.findUnique({
        where: { id: parseInt(req.params.id) }
      });
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      return tx.review.create({
        data: {
          rating,
          comment,
          authorName: authorName || 'Anonymous',
          productId: product.id
        }
      });
    });
    
    res.status(201).json(review);
  } catch (error) {
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: 'Product not found' });
    }
    throw error;
  }
});

// POST /api/products/:id/purchase - Purchase with inventory check
app.post('/api/products/:id/purchase', async (req, res) => {
  const { quantity = 1 } = req.body;
  const productId = parseInt(req.params.id);
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock product row and check stock
      const product = await tx.$queryRaw`
        SELECT * FROM products WHERE id = ${productId} FOR UPDATE
      `;
      
      if (!product[0] || product[0].stock < quantity) {
        throw new Error('Insufficient stock');
      }
      
      // Update stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } }
      });
      
      // Create order record
      return tx.order.create({
        data: {
          productId,
          quantity,
          totalPrice: product[0].price * quantity
        }
      });
    });
    
    res.status(201).json({ success: true, order: result });
  } catch (error) {
    if (error.message === 'Insufficient stock') {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    throw error;
  }
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 4: Seeding Script

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  // Categories
  const electronics = await prisma.category.create({
    data: { name: 'Electronics', slug: 'electronics', description: 'Gadgets and devices' }
  });
  
  const computers = await prisma.category.create({
    data: { name: 'Computers', slug: 'computers', parentId: electronics.id }
  });
  
  const clothing = await prisma.category.create({
    data: { name: 'Clothing', slug: 'clothing' }
  });

  // Products
  const categories = [electronics, computers, clothing];
  
  for (let i = 0; i < 100; i++) {
    const category = categories[i % categories.length];
    
    await prisma.product.create({
      data: {
        sku: faker.string.alphanumeric(8).toUpperCase(),
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price({ min: 10, max: 2000, dec: 2 })),
        stock: faker.number.int({ min: 0, max: 500 }),
        categoryId: category.id,
        reviews: {
          create: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => ({
            rating: faker.number.int({ min: 1, max: 5 }),
            comment: faker.lorem.sentence(),
            authorName: faker.person.firstName()
          }))
        }
      }
    });
  }
  
  console.log('Seeded 100 products');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Step 5: Run It

```bash
# Terminal 1: Start PostgreSQL
docker compose up -d

# Terminal 2: Run migrations and seed
npx prisma migrate dev --name init
npx prisma db seed

# Terminal 3: Start server
npx ts-node src/index.ts

# Test it
curl http://localhost:3000/api/products?limit=5
```

> **Important: Most Startups Should Not Run Their Own Auth**
>
> Building authentication from scratch is a rite of passage for learning, but in production it's often a liability.
>
> Consider managed auth providers:
> - **Clerk** — Modern, excellent DX, built for React/Next.js but works with any backend
> - **Auth0** — Enterprise-grade, extensive integrations, higher price point
> - **Supabase Auth** — Open-source, generous free tier, pairs with PostgreSQL
> - **Firebase Auth** — Google's ecosystem, very generous free tier
>
> **When to build your own:** You have dedicated security expertise, strict compliance requirements, or are building an auth product. Otherwise, buy it.

---

## 11. Summary & Checklist

### Key Takeaways

| Concept | Remember This |
|---------|--------------|
| **SQL vs NoSQL** | Use PostgreSQL for relational data, Redis for cache, consider polyglot persistence |
| **Docker** | Never install PostgreSQL directly. Use Docker Compose for consistency |
| **Prisma Schema** | Single source of truth. Schema-first, not code-first |
| **Migrations** | Version control for your database. Never manually ALTER in production |
| **Connection Pooling** | Without it, your app dies under load. Size: `(cores × 2) + spindles` |
| **Transactions** | Use them for multi-step operations. Always. |
| **N+1** | Use `include` and `select` to fetch related data in one query |

### Module 03 Checklist

- [ ] I can explain why SQL is better than in-memory arrays for production
- [ ] I can set up PostgreSQL with Docker Compose
- [ ] I've defined a Prisma schema with 1:1, 1:N, and N:M relations
- [ ] I've created and applied a migration
- [ ] I can perform CRUD operations with Prisma Client
- [ ] I understand when to drop to raw SQL
- [ ] I've configured connection pooling
- [ ] I can write transactions with proper error handling
- [ ] I can identify and prevent N+1 queries
- [ ] I've built the e-commerce catalog mini project

### Performance Targets

| Metric | Target |
|--------|--------|
| P95 API Response | <200ms (including DB roundtrip) |
| DB Connection Time | <5ms (with pooling) |
| Transaction Duration | <100ms (prevent lock contention) |
| Query Count per Request | 1-3 (avoid N+1) |

---

> **Next Module:** Module 04 - Authentication & Authorization. Learn to build secure auth systems with JWT, sessions, OAuth 2.1, and RBAC.

*Last updated: 2026-05-06 | Prisma 6.x | PostgreSQL 16+*