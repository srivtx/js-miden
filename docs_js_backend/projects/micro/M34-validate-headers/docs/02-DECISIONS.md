# M34: Design Decisions

## Option A: Manual header lookup with `req.headers`
- **Pros**: No dependencies, explicit
- **Cons**: Case-sensitivity bug (as in this project), type issues with `string | string[]`
- **Chosen**: Yes, to demonstrate the RFC pitfall

## Option B: Use Express `req.get()` method
- **Pros**: Case-insensitive, handles duplicates, returns `string | undefined`
- **Cons**: Hides the underlying complexity
- **Chosen**: No for the validator core, but used in the app layer

## Option C: Use `zod` or `joi` for header schemas
- **Pros**: Type-safe, declarative, comprehensive validation
- **Cons**: Heavy for simple header checks, learning curve
- **Chosen**: No for this micro-project

## Decision
Build manual validation to teach case-insensitivity rules, then refactor to use `req.get()` to fix the bug.
