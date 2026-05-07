# M01 Hello API: Thinking Exercises

Answer these five questions **before** you write a single line of code.

---

## Question 1: The Silence Contract

You are designing a health check endpoint for a microservice. The current implementation logs every health check request at `INFO` level. Your monitoring system polls it every 2 seconds.

A colleague argues: "We should keep the logs. If the health check fails, we need to know the exact timestamp of the last successful check."

You argue: "We should log health check transitions only — from healthy to unhealthy, and back."

Who is right? What information is lost in your approach? What information is gained?

<details>
<summary>Discussion</summary>

The colleague is optimizing for post-mortem reconstruction. You are optimizing for signal-to-noise ratio. The correct answer is a hybrid: log transitions at `WARN`/`INFO`, and log the last 10 health check results in memory only. If the service crashes, the orchestrator logs the exit. You do not need a disk trace of every heartbeat.

The lost information: exact sub-second timing of intermittent blips. The gained information: the ability to notice other anomalies in the same log stream without drowning in noise.

</details>

---

## Question 2: The Backpressure Trap

Your logger uses a queue. Under normal load, the queue depth is 0-2. During a traffic spike, it grows to 10,000. The disk is healthy. The CPU is at 20%.

What is causing the queue to grow? Is the problem in the logger, the event loop, or the operating system?

<details>
<summary>Discussion</summary>

If disk and CPU are healthy, the bottleneck is likely the libuv thread pool. `fs.write` delegates to a thread pool with a default size of 4. If 1,000 requests finish simultaneously, 996 of them wait for a thread. The queue grows because of thread pool saturation, not disk slowness.

The fix: increase `UV_THREADPOOL_SIZE`, or use a dedicated worker thread for logging, or accept that the queue is a necessary buffer and bound it (drop old entries if it exceeds a limit).

</details>

---

## Question 3: The Missing Line

A user reports that a request was processed but there is no log entry for it. You verify:

- The request reached the server (TCP dump confirms).
- The response was sent (client has it).
- The log file exists and is writable.
- There is no log line for this request.

List three distinct technical reasons why the log line could be missing.

<details>
<summary>Discussion</summary>

1. **Process crash between response and log write**: The request finished, the event was emitted, but the process crashed before `fs.appendFile` completed.
2. **Log rotation race condition**: The log was rotated between the write being queued and the write being executed. The old file was renamed, and the write went to the old FD (now pointing to `access.log.1`).
3. **Silent write failure**: `fs.appendFile` failed with `ENOSPC` or `EIO`, and the error callback was empty or swallowed.

</details>

---

## Question 4: The Cost of a Line

Your log aggregation provider charges $0.10 per GB ingested. Your service handles 10,000 requests per second. Each log line is 100 bytes. You log every request.

Calculate your monthly logging bill. Then, propose a sampling strategy that reduces the bill by 90% while preserving the ability to detect a 500-error spike within 60 seconds.

<details>
<summary>Discussion</summary>

**Monthly bill:**
- 10,000 req/s * 100 bytes = 1,000,000 bytes/s = 1 MB/s
- 1 MB/s * 2,592,000 s/month = 2,592,000 MB = ~2.47 TB/month
- 2.47 TB * $0.10/GB * 1000 GB/TB = **$247,200/month**

**Sampling strategy:**
- Log 100% of 4xx and 5xx errors (they are signal).
- Log 1% of 2xx/3xx success requests (they are noise).
- Add a counter metric for total requests (in Prometheus/CloudWatch, not logs).

With a 99% success rate:
- Errors: 100 req/s * 100 bytes = 10 KB/s
- Success sample: 9,900 req/s * 1% * 100 bytes = 9.9 KB/s
- Total: ~20 KB/s = ~1.7 GB/month = **$170/month**

To detect a 500-error spike: since 100% of errors are logged, a spike is visible immediately. The counter metric provides the aggregate view.

</details>

---

## Question 5: The Rotated File

You implement log rotation: when `access.log` reaches 10 MB, you rename it to `access.log.1` and start a new `access.log`.

An attacker floods the server with requests. The log grows to 10 MB in 30 seconds. You rotate. The attacker stops. The log is now 1 KB. 30 seconds later, the attacker resumes. The log grows to 10 MB in 30 seconds. You rotate again.

After 10 minutes, how many rotated files exist? What is the total disk usage? What is the flaw in this rotation strategy?

<details>
<summary>Discussion</summary>

- 10 minutes = 600 seconds.
- Cycles: flood (30s) + pause (30s) = 60s per cycle.
- Cycles in 10 minutes: 10.
- Rotated files: 10 (`access.log.1` through `access.log.10`).
- Total disk usage: 10 * 10 MB = 100 MB (plus current `access.log`).

**The flaw**: Time-based rotation is missing. An attacker can force infinite rotation, eventually exhausting inodes or disk space if you keep all backups. A proper strategy combines size *and* time (e.g., keep only the last 5 files, or rotate daily regardless of size).

</details>
