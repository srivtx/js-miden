# Thinking Exercises

## 1. The Health Check

Health check interval: 5s. Server dies at T=0.

**Question:** How long until traffic stops? How many requests fail?

---

## 2. The Recovery

Server recovers. Health check passes. But it's cold (empty cache).

**Question:** Do you send 100% traffic immediately? Or gradually?

---

## 3. The Weights

Server A is 2x faster than B. Weights: A=2, B=1.

**Question:** Is this optimal? What if A has a memory leak?

---

## 4. The Session

User uploads a file. Server A accepts it. Next request goes to B.

**Question:** Where's the file? How do you handle stateful requests?

---

## 5. The Cost

You have 10 servers. Load is 50%.

**Question:** Do you keep all 10 running? Or scale down?
