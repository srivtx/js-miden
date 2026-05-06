# 02-DECISIONS

## BullMQ vs Bull vs Bee
- **BullMQ**: Modern, Redis Streams, better concurrency, built-in rate limiting.
- **Bull**: Older, battle-tested, but less maintained.
- **Bee**: Minimal, lacks features.
- **Decision**: BullMQ for new projects.

## In-Process Worker vs Separate Process
- **In-Process**: Easier to deploy, shares memory, but API crashes kill workers.
- **Separate Process**: Resilient, scales independently, but needs IPC or shared Redis.
- **Decision**: In-process for curriculum simplicity; production should use separate worker processes.

## Exponential Backoff vs Fixed Delay
- **Exponential**: Reduces thundering herd on downstream failures.
- **Fixed**: Predictable, but can hammer a struggling service.
- **Decision**: Exponential with jitter.
