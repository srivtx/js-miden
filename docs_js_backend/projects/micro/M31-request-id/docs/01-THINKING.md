# M31: Mental Models

## Hot Path
1. Incoming request hits middleware
2. Check for existing `X-Request-ID` header (propagation from upstream)
3. Generate new UUID v4 if missing
4. Attach to `res.locals` or `req` object for downstream access
5. Set response header early
6. Logger reads request ID from request context on every call

## Danger Zones
- **Async boundaries**: If logger or proxy runs in a different async context, request ID can be lost
- **Error handlers**: Express error handlers run after route handlers. If the request ID is only set on the request object and error handlers don't propagate it to the response, it disappears on 500s
- **Event emitters**: If you use EventEmitter inside middleware, the context breaks
- **Cluster/Worker threads**: `async_hooks` or `AsyncLocalStorage` needed for true async context safety

## Key Insight
The request ID is "ambient context." It must be available everywhere without being explicitly passed through every function signature. In Node.js, this means either:
- Attaching to `req` and passing `req` everywhere (explicit)
- Using `AsyncLocalStorage` (implicit, modern approach)
