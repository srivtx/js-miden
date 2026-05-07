# Thinking Exercises

## 1. The Threshold

Your service fails 1% of the time normally. During deploys, it fails 50% for 30 seconds.

**Question:** What's your circuit threshold? How do you avoid opening during deploys?

---

## 2. The Fallback

The payment service is down. What do you show the user?

**Question:** Queue for later? Show error? Accept and risk?

---

## 3. The Shared State

You have 10 API servers. Each has its own circuit breaker.

**Question:** Should circuits be shared across servers? What are the trade-offs?

---

## 4. The Monitoring

Circuit is open. Users see errors.

**Question:** How do you alert? Who gets paged? What metrics matter?

---

## 5. The Recovery

Service recovers. Circuit goes HALF-OPEN. Test request fails due to cold start.

**Question:** How do you handle cold starts? Should the test be representative?
