# M32: Design Decisions

## Option A: Manual Accept header parsing
- **Pros**: Zero dependencies, full control, educational value
- **Cons**: Error-prone, doesn't handle edge cases like media range parameters
- **Chosen**: Yes, for curriculum clarity

## Option B: Use `negotiator` npm package
- **Pros**: Battle-tested, handles wildcards correctly, used by Express internally
- **Cons**: Adds dependency, abstracts away the learning
- **Chosen**: No, but recommended for production

## Option C: Use `accepts` (built into Express req.accepts)
- **Pros**: Native to Express, simplest API
- **Cons**: Hides the negotiation algorithm completely
- **Chosen**: No

## Decision
Implement manual parser to teach the RFC logic, then show how Express's `req.accepts()` simplifies it. The bug is intentionally in the wildcard matching to teach careful string comparison.
