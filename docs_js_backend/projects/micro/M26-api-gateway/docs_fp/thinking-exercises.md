# Thinking Exercises

## 1. The Timeout

Backend timeout is 30s. Gateway timeout is 5s.

**Question:** What happens to the backend request? Does it complete?

---

## 2. The Retry

Gateway retries failed requests. Backend is not idempotent.

**Question:** Duplicate requests? How do you prevent it?

---

## 3. The Auth

Gateway authenticates. Backend doesn't.

**Question:** What if someone bypasses the gateway?

---

## 4. The SSL

Gateway terminates SSL. Backend uses HTTP.

**Question:** Is internal traffic secure? What are the risks?

---

## 5. The Scale

Gateway handles 100,000 req/s. One backend instance handles 1000 req/s.

**Question:** How do you route? Load balancing strategies?
