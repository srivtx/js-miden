# 07-url-versioning.md

## WHAT

Version is part of the URL path: `/v1/users`, `/v2/users`.

## WHY

Explicit and cache-friendly. Easy to test in browser.

## HOW

```typescript
app.use('/v1', v1Router);
app.use('/v2', v2Router);
```

Pros:
- Visible and explicit
- Easy to route
- Cacheable

Cons:
- Clutters URL
- Hard to change version for single resource
