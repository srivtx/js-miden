# The 3AM Page: The Thundering Herd

It's 3:00 AM. Your downstream service is down.

**Monitoring:** "Database received 100,000 identical queries in 1 second."

You check the retry code:
```javascript
async function fetchWithRetry(url, retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      await sleep(1000); // Fixed 1 second delay
    }
  }
}
```

**Every failed request retries 10 times with exactly 1-second delay.**

1000 failed requests × 10 retries = 10,000 requests. All arriving at the same time (synchronized by the 1-second delay).

**You created a thundering herd that DDoS-ed your own database.**

---

## Your Turn

### Q1: Why do synchronized retries make things worse?

Shouldn't retries help recover from failures?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Synchronization amplifies load

If all retries happen at the same time:
- Second 1: 1000 original requests fail
- Second 2: 1000 retries arrive simultaneously
- Second 3: 1000 more retries arrive simultaneously
- ...

**The database receives 1000 requests every second. It never recovers.**

### The Fix: Jitter

```javascript
const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
const jitter = Math.random() * delay; // Add randomness!
await sleep(delay + jitter);
```

**Jitter spreads retries across time.** Instead of 1000 requests at T=2, you get 100 requests at T=1.5, 200 at T=2.1, etc.

**This gives the downstream service breathing room to recover.**
