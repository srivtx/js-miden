# 02-DECISIONS: Config Server

## WHAT decisions were made?

1. **In-memory JavaScript object as the config store**
2. **Manual validation function**
3. **REST API with URL parameters for app and env**

## WHY these decisions?

### Decision 1: In-Memory Object

**Pros:**
- Extremely fast reads.
- Zero dependencies.

**Cons:**
- Lost on restart.
- No replication.
- No versioning or audit trail.

**Alternatives:**
- **Git-backed config (Spring Cloud Config)**: Store configs in a Git repository.
  - *Pros:* Full history, pull requests for changes, branching per environment.
  - *Cons:* Slower reads; requires Git infrastructure.
- **Database (PostgreSQL, MongoDB)**: Persistent, queryable, scalable.
  - *Pros:* Durability, replication, complex queries.
  - *Cons:* Adds operational complexity.
- **Dedicated config service (AWS AppConfig, LaunchDarkly)**: Managed, with feature flags.
  - *Pros:* Gradual rollouts, targeting, analytics.
  - *Cons:* Vendor lock-in, cost.
- **Verdict:** In-memory is fine for a demo. Production should use Git or a database with audit logging.

### Decision 2: Manual Validation

**Pros:**
- Custom logic per project.
- No schema language to learn.

**Cons:**
- Easy to miss edge cases (current validator accepts negative numbers).
- Hard to maintain as config schemas evolve.

**Alternatives:**
- **JSON Schema (Ajv)**: Declarative, standardized validation.
  - *Pros:* Rich type checking, string formats, conditional logic.
  - *Cons:* Learning curve.
- **Zod**: TypeScript-first schema validation.
  - *Pros:* Inferred types, great DX, composable.
  - *Cons:* Requires TypeScript.
- **Verdict:** Use Zod or Ajv for production. Manual validation is too error-prone.

### Decision 3: REST API with URL Parameters

**Pros:**
- Clear URL structure: `/config/:app/:env`.
- Easy to cache and route.

**Cons:**
- URL parameters are strings; no type safety.
- `POST` for updates is not idempotent; `PUT` or `PATCH` would be better.

**Alternatives:**
- **GraphQL**: Flexible queries; clients request only what they need.
  - *Pros:* Single endpoint, strong typing.
  - *Cons:* Overkill for simple key-value config.
- **gRPC**: Binary, fast, typed.
  - *Pros:* Performance, generated clients.
  - *Cons:* Harder to debug without tools.
- **Verdict:** REST is perfect for config. Use `PUT` for idempotent updates.

## WRONG vs RIGHT Decision-Making

| Decision | WRONG Approach | RIGHT Approach |
|----------|----------------|----------------|
| Storage | "In-memory is fast; I'll use that." | "Use durable storage with audit trails for production." |
| Validation | "I'll write custom checks." | "Use a schema library like Zod or JSON Schema." |
| API design | "POST for everything." | "Use PUT for idempotent updates, GET for reads." |

## Final Recommendation

For production, use **Spring Cloud Config**, **HashiCorp Vault**, or a managed service like **AWS AppConfig**. They provide encryption, versioning, environment isolation, and audit trails that are non-negotiable for production systems.
