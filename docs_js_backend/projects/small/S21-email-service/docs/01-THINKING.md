# 01-THINKING.md

## Mental Model

Think of email delivery like a postal system. You do not stand at the mailbox waiting for the letter to reach its destination. You drop it in the mailbox (queue), get a receipt (202 Accepted), and a postal worker (background processor) handles delivery later. If the first attempt fails, they retry.

## Key Insights

### Insight 1: HTTP is synchronous; email is asynchronous

HTTP requests must return quickly (< 100ms). SMTP is inherently unreliable and slow (100-5000ms). These two timelines cannot be coupled.

### Insight 2: A "sent" status from SMTP is a lie

SMTP `250 OK` only means the receiving server accepted the message. It says nothing about inbox placement, spam filtering, or bounces. You need asynchronous bounce/complaint webhooks for real status.

### Insight 3: Retry is not optional

Studies show 5-15% of first-attempt SMTP deliveries fail due to transient issues (greylisting, rate limits, temporary outages). Without retry, you permanently lose legitimate messages.

### Insight 4: Templates need versioning

Product teams change email copy constantly. Hardcoded strings in code require deployments to fix typos. Templates should live outside the deployment artifact.

## Design Philosophy

- **Accept-then-process**: Always return 202 immediately, process asynchronously
- **At-least-once delivery**: Retry with exponential backoff until success or permanent failure
- **Idempotency**: Same request sent twice should not create duplicate emails
- **Observability**: Every email has a lifecycle: queued → sending → sent/bounced → (retry)

## Trade-offs Considered

| Approach | Latency | Durability | Complexity | Best For |
|----------|---------|------------|------------|----------|
| In-memory queue | Low | None (crash = loss) | Minimal | Prototypes only |
| Redis list + worker | Low | High | Medium | Most applications |
| Full message broker (RabbitMQ/SQS) | Medium | Very High | High | Enterprise scale |
| Provider API only (SendGrid/SES) | Low | High | Low | When you trust the provider |

## ASCII: Thought Process

```
User requests email
        |
        v
+---------------+
| Queue it?     |
+---------------+
   |         |
  YES        NO
   |         |
   v         v
Fast 202   Slow 200
Durable    Fragile
Scalable   Brittle
```
