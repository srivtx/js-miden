# 08-troubleshooting.md

## Send to invalid tokens wastes resources

**Cause:** No validation before provider calls.

**Fix:** Validate token format, length, and registration status.

## Batch send is slow

**Cause:** Sequential processing in loop.

**Fix:** Use `Promise.all`, provider batch APIs, or message queues.

## Token not found for platform

**Cause:** Token not registered before send.

**Fix:** Register tokens on app install, validate before sending.

## Delivery status always pending

**Cause:** Async mock not awaited or results not stored.

**Fix:** Ensure `results` array populated before returning.
