# 08-header-versioning.md

## WHAT

Version is specified via Accept header.

## WHY

URLs remain clean. Version is a content negotiation concern.

## HOW

```
Accept: application/vnd.api.v1+json
Accept: application/vnd.api.v2+json
```

```typescript
app.use((req, res, next) => {
  const accept = req.get('Accept') || '';
  if (accept.includes('v1')) {
    return v1Router(req, res, next);
  }
  if (accept.includes('v2')) {
    return v2Router(req, res, next);
  }
  next();
});
```

Pros:
- Clean URLs
- RESTful

Cons:
- Harder to debug
- Caching is complex
