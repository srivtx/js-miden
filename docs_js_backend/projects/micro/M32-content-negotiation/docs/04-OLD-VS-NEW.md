# M32: Old Patterns vs New Patterns

## 2015: Manual string splitting + regex
```js
var accept = req.headers.accept;
var types = accept.split(',').map(function(t) { return t.trim(); });
if (types.indexOf('application/json') > -1) return 'json';
```
- **Problems**: Ignores q-values, ignores wildcards, naive string matching

## 2025: `req.accepts()` or structured parsing
```ts
const format = req.accepts(['json', 'html', 'xml', 'text']);
```
- **Benefits**: Express 5 handles RFC 7231 correctly; handles wildcards, q-values, parameters

## Curriculum vs Production
For learning, build the parser manually. For production, use `req.accepts()` or the `negotiator` package.
