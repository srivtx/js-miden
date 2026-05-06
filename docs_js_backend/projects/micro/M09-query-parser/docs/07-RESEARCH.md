# M09: Query Param Parser — Latest Trends & Research

## Trend 1: Standard Schema Interfaces (2024)

Libraries like Zod, Valibot, and ArkType are converging on a **Standard Schema** specification. This allows frameworks to accept any validation library without vendor lock-in.

**WHAT:** A shared interface that validation libraries implement.
**WHY:** Frameworks like tRPC, React Hook Form, and Astro can accept Zod, Valibot, or ArkType schemas interchangeably.
**Source:** https://github.com/standard-schema/standard-schema

## Trend 2: Valibot --- The Tree-Shakable Alternative

Valibot is a schema library with a modular architecture. You import only the validators you use.

**Comparison:**
- Zod: ~12KB (all or nothing)
- Valibot: ~300B base + per-validator imports
- API is very similar to Zod, making migration easy.

**Source:** https://valibot.dev/

## Trend 3: Native `URLPattern` API

The `URLPattern` API (supported in modern browsers and Deno) provides declarative URL matching, including query parameter extraction.

```javascript
const pattern = new URLPattern({ pathname: '/users', search: 'page=:page&limit=:limit' });
const result = pattern.exec('https://example.com/users?page=2&limit=10');
```

**Status:** Experimental in Node.js. Worth monitoring for future native parsing.

**Source:** https://developer.mozilla.org/en-US/docs/Web/API/URLPattern

## Trend 4: OpenAPI-Driven Validation

Tools like `@asteasolutions/zod-to-openapi` and `fastify-zod` generate OpenAPI specs from Zod schemas and vice versa. This bridges documentation and validation.

**WHAT:** Your Zod schema becomes the single source of truth for both runtime validation and API documentation.
**WHY:** Eliminates drift between docs and code.

**Source:** https://github.com/asteasolutions/zod-to-openapi

## Trend 5: Type-Safe API Clients (tRPC, ts-rest)

Instead of parsing query params manually on the client and server, frameworks like tRPC generate type-safe RPC clients from Zod schemas. The query parameters are validated at compile time.

**Impact:** For internal APIs, manual query parsing may become obsolete as RPC frameworks handle serialization.

**Source:** https://trpc.io/

## WRONG vs RIGHT

**WRONG:** Building a custom validation framework instead of using established libraries.
**RIGHT:** Adopting Zod/Valibot and monitoring Standard Schema for interoperability.

## Sources
- Standard Schema: https://github.com/standard-schema/standard-schema
- Valibot Docs: https://valibot.dev/
- URLPattern MDN: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
- tRPC Docs: https://trpc.io/
