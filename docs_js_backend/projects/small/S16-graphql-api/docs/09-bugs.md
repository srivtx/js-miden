# 09-bugs.md

## WHAT

Two intentional bugs demonstrate common GraphQL pitfalls.

## WHY

Understanding these bugs prevents performance and security issues in production.

## HOW

### Bug 1: N+1 Query

**Symptom**: `getAuthor()` logs once per post instead of once per batch.

**Fix**: Use DataLoader in the author resolver.

### Bug 2: No Depth Limit

**Symptom**: Recursive queries succeed and could DoS the server.

**Fix**: Implement actual depth calculation in the middleware.

```typescript
export function depthLimit(maxDepth: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const query = req.body.query || '';
    const depth = calculateDepth(query);
    if (depth > maxDepth) {
      return res.status(400).json({ error: 'Query too deep' });
    }
    next();
  };
}
```
