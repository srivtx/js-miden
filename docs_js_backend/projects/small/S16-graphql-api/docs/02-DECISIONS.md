# 02-DECISIONS.md

## Key Design Decisions

### Decision 1: graphql-http vs Apollo Server vs Yoga

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **graphql-http** | Lightweight, spec-compliant, zero deps | No built-in subscriptions, minimal tooling | ✅ **CHOSEN** — Best for learning fundamentals |
| Apollo Server | Rich ecosystem, federation, studio | Heavy, vendor lock-in, complex config | ❌ Too heavy for this project |
| GraphQL Yoga | Modern, fast, subscriptions | Still evolving, smaller community | ❌ Good but graphql-http is simpler |
| express-graphql | Familiar | Deprecated, unmaintained | ❌ Do not use |

**Rationale**: We chose `graphql-http` because it implements the GraphQL over HTTP spec directly without hiding mechanics. Students should see raw request handling before using high-level frameworks.

### Decision 2: Code-First vs Schema-First

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Code-First** (graphql-js) | TypeScript types enforce schema, refactor-safe | Verbose, no SDL to share with frontend | ✅ **CHOSEN** — Type safety at compile time |
| Schema-First (SDL + codegen) | Clean SDL file, language-agnostic | Codegen step, type mismatches possible | ❌ Good for larger teams, adds complexity |
| Pothos | Type-safe builder, modern | Another abstraction to learn | ❌ Too abstract for fundamentals |

**Rationale**: Using `graphql-js` directly makes every type definition explicit. Students see `GraphQLObjectType`, `GraphQLString`, etc. — the building blocks that all frameworks use under the hood.

### Decision 3: DataLoader Integration

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **DataLoader** | Battle-tested, per-request caching, batching | Node-specific, learning curve | ✅ **CHOSEN** — Industry standard |
| Custom batching | No dependency | Bug-prone, reinvents wheel | ❌ Don't reinvent |
| JOIN in resolver | Simple for small apps | Doesn't scale, breaks field-level resolver model | ❌ Anti-pattern |
| Prisma/DataMapper | Handles N+1 automatically | ORM magic hides mechanics | ❌ Good but hides the lesson |

**Rationale**: DataLoader is the Facebook reference implementation. Understanding it teaches the batching pattern applicable to any language.

### Decision 4: Depth Limiting Strategy

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Custom AST traversal** | Full control, educational | Must implement correctly | ✅ **CHOSEN** — Shows how GraphQL works internally |
| graphql-depth-limit | Battle-tested, simple | Hides implementation | ❌ Would skip the learning |
| Query whitelisting | Most secure | Prevents ad-hoc queries | ❌ Too restrictive for this API |
| Complexity scoring | Precise cost model | Hard to calibrate | ❌ Overkill for small API |

**Rationale**: Writing a depth limiter requires understanding the GraphQL AST (`DocumentNode`, `SelectionSet`, etc.). This is essential knowledge for GraphQL developers.

### Decision 5: In-Memory Store vs Real Database

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **In-Memory Arrays** | Zero setup, tests run fast | Not persistent, not realistic | ✅ **CHOSEN** — Focus on GraphQL, not DB ops |
| PostgreSQL + Prisma | Production-realistic | Setup complexity, Docker needed | ❌ Distracts from GraphQL concepts |
| SQLite | File-based, simple | Still adds ORM/SQL complexity | ❌ Same issue |

**Rationale**: The bugs (N+1, depth limit) are architectural, not database-related. In-memory storage keeps the focus on resolver patterns.
