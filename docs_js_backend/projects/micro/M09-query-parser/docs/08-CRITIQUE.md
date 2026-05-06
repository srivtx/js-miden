# M09: Query Param Parser — Senior Engineer Review

## Review 1: "Zod is Great, But Don't Forget the Database Layer"

> *"I've seen teams invest heavily in Zod schemas for query params, then turn around and interpolate those same 'validated' strings into SQL queries. Validation at the app layer is necessary but not sufficient. The database layer must also use parameterized queries. A validated enum value is still a string that can contain SQL if your validation regex has a bug."*

**Verdict:** Agree. Defense in depth. Zod validates shape and type; the database driver validates against injection.

## Review 2: "Type Coercion is a Footgun"

> *"`z.coerce.number()` will turn an empty string `""` into `0`. Is that what you want? If a user sends `?limit=`, do you want `limit=0` or a validation error? Coercion hides bugs. I prefer `z.string().transform(v => { const n = Number(v); if (isNaN(n)) throw ...; return n; })`."*

**Verdict:** Partially agree. `.coerce` is convenient but aggressive. For APIs where missing params should error, explicit transforms are better. For quick prototypes, `.coerce` is fine. Document the behavior.

## Review 3: "Cursor Pagination is Overkill for 90% of Use Cases"

> *"Teams jump to cursor pagination because they read a blog post about its performance benefits. But if your table has < 100K rows and your primary use case is an admin dashboard with page numbers, offset pagination is simpler and perfectly adequate. Don't optimize prematurely."*

**Verdict:** Agree. Choose pagination strategy based on data size and UX requirements, not hype.

## Review 4: "Query Parsing Belongs in Middleware, Not Controllers"

> *"Every controller shouldn't be calling `schema.parse(req.query)`. Extract a `validateQuery(schema)` middleware and attach `req.parsedQuery`. This keeps controllers focused on business logic and makes testing easier."*

**Verdict:** Agree. This is exactly the pattern demonstrated in the build guide.

## Review 5: "Don't Ignore Array Parameters"

> *"`?tag=js&tag=node` is a common pattern. Zod handles this with `z.array(z.string())`, but Express's `req.query` behavior depends on whether `extended: true` is set. Test this carefully. I've seen bugs where `tag=js` returns `"js"` but `tag=js&tag=node` returns `["js", "node"]`, breaking schemas that expect an array."*

**Verdict:** Agree. Use `z.union([z.string(), z.array(z.string())])` or preprocess to normalize arrays.

## Review 6: "Performance of Validation Libraries"

> *"For high-throughput APIs, validation overhead matters. Benchmarks show Zod is ~2-3x faster than Yup but slower than raw Joi for some cases. If you're doing 10K RPS, consider caching parsed schemas or using compiled validators like Ajv for JSON Schema."*

**Verdict:** Valid concern. For most applications, Zod's performance is acceptable. For extreme throughput, Ajv (JSON Schema) is the industry standard for speed.

## Final Verdict

The M09 Query Param Parser pattern is **production-ready** with the following caveats:
1. Always pair app-layer validation with database-layer parameterization.
2. Be explicit about coercion behavior (empty strings -> `0`).
3. Choose pagination based on requirements, not trends.
4. Extract validation into reusable middleware.
5. For >10K RPS, benchmark Zod vs Ajv.

## Sources
- Ajv Performance: https://ajv.js.org/guide/managing-schemas.html
- Zod vs Yup Benchmarks: https://github.com/moltar/typescript-runtime-type-benchmarks
