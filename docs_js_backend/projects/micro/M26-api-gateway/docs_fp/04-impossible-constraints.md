# Impossible Constraint: Single Thread

**Task:** Handle 10,000 concurrent requests with 1 thread.

**Constraint:** Node.js is single-threaded.

---

## Your Turn

How does a single-threaded server handle 10,000 concurrent connections?

**Write your answer:**

<br><br><br><br><br>

---

## The Reveal: Event Loop + Non-Blocking I/O

Node.js uses:
- **Event loop:** Single thread for JavaScript
- **Libuv thread pool:** For file system, DNS (4 threads default)
- **Kernel async I/O:** For network (epoll, kqueue, IOCP)

**Network I/O doesn't block the event loop.** The kernel handles it. Node.js gets notified when data arrives.

**But CPU-intensive work blocks:**
- JSON parsing of 100MB payload
- Image processing
- Complex calculations

**This constraint forces you to realize:**

> Node.js scales with I/O concurrency, not CPU parallelism. Gateways are I/O-bound, so they scale well. But add CPU work and everything blocks.
