# Research Notes

## Sources

- **RFC 7807 — Problem Details for HTTP APIs**
  - Key finding: Standardizes error response format with `type`, `title`, `status`, `detail`, `instance`. Widely adopted by Spring Boot, ASP.NET Core, and OpenAPI.
  - https://tools.ietf.org/html/rfc7807

- **OWASP Error Handling Cheat Sheet**
  - Key finding: Never expose stack traces, internal paths, or sensitive data in error responses. Log internally, return generic messages externally.
  - https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html

- **Node.js Documentation — `response.headersSent`**
  - Key finding: Once headers are sent, any attempt to write headers again throws `ERR_HTTP_HEADERS_SENT`. Always check `headersSent` in error handlers.
  - https://nodejs.org/api/http.html#responseheaderssent

- **Express 5 Release Notes**
  - Key finding: Express 5 automatically catches rejected promises in async route handlers and forwards them to the error handler. No wrapper functions needed.
  - https://expressjs.com/en/guide/migrating-5.html

- **IETF HTTP Semantics (RFC 9110)**
  - Key finding: Defines HTTP status codes and their semantics. 4xx = client error, 5xx = server error. Error responses should include representation of the problem.
  - https://www.rfc-editor.org/rfc/rfc9110.html

- **Snyk Blog — Stack Trace Exposure**
  - Key finding: Stack traces are an information disclosure vulnerability (CWE-209). They reveal file paths, dependency versions, and internal architecture.
  - https://snyk.io/blog/stack-trace-exposure/

## Latest Trends (2025)

- **Structured Error Logging:** Modern APIs return RFC 7807 to clients AND emit structured JSON logs to stdout with the same `errorId`. This allows one-click correlation between user reports and server logs.
- **OpenAPI Error Schemas:** OpenAPI 3.1 natively supports `problem+json` as a response media type. Code generators can auto-produce client-side error parsers.
- **Error Classification:** AI-powered log analysis tools (e.g., Sentry's issue grouping, Datadog's error tracking) rely on consistent error shapes. RFC 7807's `type` field is perfect for this.

## Benchmarks

- Error handler overhead: ~0.1ms per request (constructing a JSON object and sending it).
- `crypto.randomUUID()` overhead: ~0.001ms per call (negligible).
- Stack trace generation: ~0.05ms per error (only happens on errors, not normal requests).

## Industry Adoption

- **Stripe API:** Uses a custom error format but follows RFC 7807 principles (consistent fields, error codes, request IDs).
- **GitHub API:** Returns structured error objects with `message`, `documentation_url`, and `errors` array.
- **Twitter/X API:** Uses RFC 7807-style `detail`, `title`, `type` fields in v2.
- **Spring Boot:** Native `ProblemDetail` class implements RFC 7807 out of the box.
