# M01 Hello API: The Incident

## 3:14 AM — PagerDuty Screaming

You are the on-call engineer. Your phone erupts. The primary API gateway is returning `502 Bad Gateway` for 40% of requests. The load balancer health checks are passing, but customers are furious.

You check the logs. They are empty. Not truncated — **empty**. The log aggregation service has nothing from the past 6 hours.

You SSH into the gateway node. Disk usage is at 100%. The log file is 47 GB and growing. The application cannot open new file descriptors. Every incoming request fails before it hits your route handlers.

## The Log File

```
/var/log/api-gateway/access.log  47G  100%  /dev/xvda1
```

You tail the log:

```
POST /v1/orders 200 14ms
POST /v1/orders 200 12ms
POST /v1/orders 200 15ms
GET  /v1/health 200 1ms
GET  /v1/health 200 1ms
GET  /v1/health 200 1ms
...
```

The health check is being logged at the same volume as real traffic. A monitoring probe hits `/health` every 2 seconds from 12 nodes. That is 21,600 log lines per hour of zero-value noise. Over 6 hours, that is 129,600 lines. But the real culprit is something else.

## Hidden Culprit

Search the log for this:

```bash
grep "200 OK" /var/log/api-gateway/access.log | wc -l
# 482,103,291 lines
```

A bug in the client SDK is retrying every failed request 50 times with no backoff. The server returns `200 OK` for every retry because the endpoint is idempotent. Every retry is logged. The log volume is not traffic. It is **retry amplification**.

## The Fix (Hidden)

<details>
<summary>Click to reveal</summary>

1. **Rotate and truncate the log immediately** to restore file descriptors:
   ```bash
   > /var/log/api-gateway/access.log
   systemctl restart api-gateway
   ```

2. **Add log sampling for health checks**:
   ```javascript
   app.use((req, res, next) => {
     if (req.path === '/health') {
       // Log only 1% of health checks
       if (Math.random() < 0.01) {
         req.logSilently = false;
       } else {
         req.logSilently = true;
       }
     }
     next();
   });
   ```

3. **Add a circuit breaker on the client** to prevent retry storms.

4. **Add a `Retry-After` header** on `429` responses.

5. **Structure logs with a severity field** so info-level noise can be filtered at the collector.

</details>

## Post-Incident Review

| Question | Answer |
|----------|--------|
| Why did the disk fill? | Unfiltered logging of high-frequency health checks + retry amplification |
| Why did health checks pass? | The LB checks `/health`, which was still responding. The FD exhaustion affected new business requests only. |
| What monitoring gap existed? | Disk usage was not alerted. Log volume was not alerted. Only error rate was watched. |
| What architectural flaw? | Logging was a side effect in the request path with no backpressure or sampling. |

## The Real Lesson

Logging is not free I/O. Every line has a cost: disk, CPU, bandwidth, and eventually, availability. The system that tells you what is wrong can become the reason everything fails.
