# 01-THINKING.md

## Mental Model

Think of push notifications like delivering flyers. The naive approach is driving to each house individually. The correct approach is:
1. Filter out addresses that don't exist (token validation)
2. Load a truck with all flyers for one neighborhood (batching)
3. Drive once, deliver to all houses on the route (multicast)

## Key Insights

### Insight 1: Provider APIs are designed for batching

FCM supports up to 500 tokens per multicast request. APNS HTTP/2 supports multiplexing hundreds of streams over a single connection. Using these features is not optional at scale—it is mandatory.

### Insight 2: Invalid tokens are expensive

Each invalid token sent to FCM or APNS counts against your API quota. Worse, repeatedly sending to invalid tokens can get your sender ID blacklisted. Validation before sending saves money and reputation.

### Insight 3: Platform detection must be reliable

FCM tokens and APNS tokens look different, but you cannot reliably distinguish them by format alone. The service must store platform metadata at registration time and use it at send time.

### Insight 4: Token rotaton is normal

APNS tokens change when users reinstall the app. FCM tokens change when the app is restored on a new device. A production system needs token cleanup jobs that remove invalid tokens after each send.

## Design Philosophy

- **Validate early, fail fast**: Reject bad tokens before any provider call
- **Batch by provider**: Group Android tokens for FCM multicast, iOS tokens for APNS multiplexing
- **Parallelize where possible**: Independent batches can fire simultaneously
- **Cleanup continuously**: Remove invalid tokens from the database after each campaign

## Trade-offs Considered

| Approach | Latency (50 notifs) | Provider Calls | Complexity | Best For |
|----------|--------------------|----------------|------------|----------|
| Sequential one-by-one | 500ms | 50 | Minimal | < 10 users |
| Parallel Promise.all | 15ms | 50 | Low | < 100 users |
| FCM multicast + APNS multiplex | 15ms | 1-2 | Medium | < 500K users |
| Message queue + workers | 100ms (queued) | 1-2 | High | 1M+ users |

## ASCII: Decision Tree

```
How many notifications?
        |
   +----+----+
   |         |
 <100     100-500K
   |         |
   v         v
Promise.all  Provider batch APIs
   |         |
   v         v
Fast      Fast + cheap
Simple    Slightly complex
```
