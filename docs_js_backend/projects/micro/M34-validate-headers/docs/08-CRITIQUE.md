# M34: Senior Engineer Review

## Strengths
- Configurable strict/lenient modes
- Clean rule-based architecture
- Early validation prevents downstream errors

## Weaknesses
- **Case-sensitivity bug**: Fundamental HTTP protocol violation
- **No type narrowing**: `req.headers` values can be `string[]`
- **No OpenAPI integration**: Rules are code-only, not documented automatically

## Recommendations
1. Always use `req.get(name)` for header lookups in Express
2. In production, use `zod` schemas with a request validator wrapper
3. Generate OpenAPI spec from Zod schemas using `zod-to-openapi`
4. Consider validating at the API gateway (Kong, AWS API Gateway) instead of per-service

## Grade: B-
The case-sensitivity bug is a critical protocol error. Fix immediately.
