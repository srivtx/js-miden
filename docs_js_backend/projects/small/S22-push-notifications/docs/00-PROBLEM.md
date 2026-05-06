# 00-PROBLEM.md

## The Core Problem

How do you send push notifications to thousands of mobile devices efficiently, without wasting API quota on invalid tokens, and without making 10,000 individual HTTP requests?

## Real-World Context

Modern apps rely on push notifications for engagement: breaking news, chat messages, order updates, promotional campaigns. A mid-size app with 100K daily active users might send 1M+ notifications per day. Doing this naively—one HTTP request per device—creates latency, cost, and rate-limit disasters.

## Specific Pain Points

1. **Invalid tokens**: Unregistered, expired, or malformed device tokens waste provider API calls
2. **No batching**: Sequential one-by-one sending scales linearly and hits provider rate limits
3. **Platform complexity**: iOS (APNS) and Android (FCM) have different protocols, token formats, and batch limits
4. **No validation**: Sending to "short" or empty tokens burns quota and pollutes metrics
5. **Linear slowdown**: 100 notifications takes 10x longer than 10 notifications with no optimization

## What This Project Demonstrates

A push notification service that registers device tokens, sends to FCM (Android) and APNS (iOS) mocks, and attempts batch sending—but fails at both token validation and true batch optimization.

## ASCII: Naive vs Correct Flow

```
NAIVE (BROKEN)                              CORRECT (BATCHED)
==============                              =================

Client sends 50 notifications               Client sends 50 notifications
        |                                          |
        v                                          v
  +-----------+                             +-----------+
  | Loop 50x  |                             | Validate  |
  | 1 req each|                             | all tokens|
  | 10ms each |                             | (filter)  |
  | = 500ms   |                             +-----------+
  +-----------+                                   |
                                                  v
                                           +-----------+
                                           | FCM batch |
                                           | 500/token |
                                           | = 1 req   |
                                           | (10ms)    |
                                           +-----------+

TIME: 500ms+                                TIME: ~15ms
COST: 50 API calls                          COST: 1 API call
```

## Domain

Mobile push infrastructure, FCM multicast, APNS HTTP/2, token lifecycle management, batch optimization.
