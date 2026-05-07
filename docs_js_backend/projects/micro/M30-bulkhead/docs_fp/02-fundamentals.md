# Fundamentals: Resource Isolation

**Task:** Build separate pools for critical vs non-critical requests.

```javascript
const pools = {
  critical: new Semaphore(20),
  standard: new Semaphore(50),
  background: new Semaphore(10)
};
```

Critical requests always have slots. Background requests are limited.
