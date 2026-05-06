# M31: Design Decisions

## Option A: Attach to `req` object
- **Pros**: Simple, no extra dependencies, explicit
- **Cons**: Must pass `req` to every function that logs; easy to lose in utility functions
- **Chosen**: Yes, for simplicity in this micro-project

## Option B: Use `AsyncLocalStorage` (Node 16.4+)
- **Pros**: Truly ambient context, works across async boundaries without passing `req`
- **Cons**: Slightly more complex, harder to test, can leak context in edge cases
- **Chosen**: No, but recommended for production

## Option C: Use `cls-hooked` or `continuation-local-storage`
- **Pros**: Works in older Node versions
- **Cons**: Patches Node internals, fragile, deprecated patterns
- **Chosen**: No

## Decision
Use explicit `req` attachment for the curriculum. In production, migrate to `AsyncLocalStorage` and a DI container for logger instances.
