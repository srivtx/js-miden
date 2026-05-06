# 02-DECISIONS

## Monolith Dispatcher vs Per-Channel Microservices
- **Monolith**: Single codebase, easier to reason about, but one channel failure can affect others.
- **Microservices**: Independent scaling and failure domains, but operational overhead.
- **Decision**: Monolith with adapter pattern for curriculum; production may split by channel.

## Handlebars vs Simple String Replace
- **Handlebars**: Rich logic, loops, partials, but potential code injection if not configured.
- **Simple Replace**: Fast, safe, but limited.
- **Decision**: Simple replace for basic templates; Handlebars for complex layouts with strict escaping.

## Sync vs Async Delivery
- **Sync**: Caller waits for all channels; simple but slow.
- **Async**: Caller enqueues, returns immediately; resilient but needs status tracking.
- **Decision**: Sync for simplicity in this project; real systems should be async with a queue.
