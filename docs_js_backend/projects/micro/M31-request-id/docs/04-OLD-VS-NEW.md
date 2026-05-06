# M31: Old Patterns vs New Patterns

## 2015: `uuid` npm + `continuation-local-storage`
```js
var uuid = require('uuid');
var cls = require('continuation-local-storage');
var ns = cls.createNamespace('app');

app.use(function(req, res, next) {
  ns.run(function() {
    ns.set('requestId', uuid.v4());
    next();
  });
});
```
- **Problems**: `cls-hooked` patches Node internals, fragile, memory leaks

## 2025: Native `crypto.randomUUID` + `AsyncLocalStorage`
```ts
import { AsyncLocalStorage } from 'async_hooks';
const als = new AsyncLocalStorage<string>();

app.use((req, res, next) => {
  const id = req.get('X-Request-ID') || crypto.randomUUID();
  als.run(id, next);
});
```
- **Benefits**: Native, fast, no monkey-patching, works with Promise chains
