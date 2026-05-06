# M32: Content Negotiation Middleware

## WHAT
A middleware that parses the HTTP `Accept` header to determine the client's preferred response format, supporting JSON, XML, HTML, and plain text.

## WHY
Clients (browsers, mobile apps, IoT devices) prefer different data formats. A single endpoint should serve the best format based on client capabilities, improving interoperability and developer experience.

## Constraints
- Must parse `Accept` header quality values (q-values)
- Must support JSON, XML, HTML, text/plain
- Must default to JSON when no match found
- Must handle wildcard patterns like `*/*`
- Must be extensible for additional formats
