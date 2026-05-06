# M09: Query Param Parser — Architecture Decisions

## Decision 1: String Parsing vs Type Coercion

**Context:** Query parameters arrive as strings. We need booleans, numbers, dates, and arrays.

**Option A: Manual Parsing (Split & Coerce)**
```javascript
const params = {};
req.url.split('?')[1].split('&').forEach(pair => {
  const [key, val] = pair.split('=');
  params[key] = decodeURIComponent(val);
});
```

**Option B: URLSearchParams**
```javascript
const params = new URLSearchParams(req.url.split('?')[1]);
```

**Option C: Schema-Driven Coercion (Zod)**
```javascript
const schema = z.object({
  count: z.coerce.number(),
  active: z.coerce.boolean(),
});
```

**Decision:** Use **Option C (Zod)** as the primary mechanism, with **Option B (URLSearchParams)** as the underlying extractor.

**Rationale:**
- Manual parsing (Option A) is error-prone and re-invents the wheel.
- URLSearchParams (Option B) handles encoding but provides no type safety.
- Zod (Option C) provides declarative schemas, excellent error messages, and TypeScript integration.

**Trade-offs:**
- Zod adds ~12KB to the bundle.
- Runtime validation has a small CPU cost (~0.1ms per request), negligible compared to I/O.

## Decision 2: Validation Library (Zod vs Joi vs Yup)

| Feature | Zod | Joi | Yup |
|---------|-----|-----|-----|
| Bundle Size | ~12KB | ~100KB | ~25KB |
| TypeScript | Native | @types/joi | Native |
| Performance | Fast | Slower | Moderate |
| Error Messages | Excellent | Good | Good |
| Browser + Node | Yes | Node mainly | Yes |
| Ecosystem | Growing | Mature | React-focused |

**Decision:** **Zod**

**Rationale:**
- Native TypeScript inference without separate type definitions.
- Smaller bundle size than Joi.
- Active maintenance and growing ecosystem (tRPC, React Hook Form).
- Joi is powerful but heavyweight for query parameter validation.

**WRONG:** Using Joi in a modern TypeScript project because "it's what we always used."
**RIGHT:** Choosing Zod for first-class TypeScript support and smaller footprint.

## Decision 3: Pagination Strategy

**Option A: Offset Pagination**
```javascript
?page=2&limit=20
// SQL: OFFSET 20 LIMIT 20
```

**Option B: Cursor Pagination**
```javascript
?cursor=eyJpZCI6MTAwLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxIn0=&limit=20
// SQL: WHERE (created_at, id) > (timestamp, 100) ORDER BY created_at, id LIMIT 20
```

**Decision:** Support **both**, with offset as default and cursor for high-churn data.

**Rationale:**
- Offset pagination is intuitive for UIs with page numbers.
- Cursor pagination prevents duplicate/missed records when data changes during traversal (the "offset drift" problem).
- Cursor pagination requires an ordered, unique column (e.g., `(created_at, id)`).

**Trade-offs:**
- Offset is simpler but becomes slow at high offsets (`OFFSET 1000000` is expensive).
- Cursor is fast and consistent but cannot jump to arbitrary pages.

**WRONG:** Using offset pagination for real-time feeds where items are inserted at the top.
**RIGHT:** Using cursor pagination for feeds and offset pagination for admin tables.

## Sources
- Zod GitHub: https://github.com/colinhacks/zod
- Joi vs Zod Benchmark: https://github.com/moltar/typescript-runtime-type-benchmarks
- Cursor Pagination Guide: https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/
