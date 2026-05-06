# 08-event-versioning.md

## WHAT

Events may need schema changes over time (upcasting).

## WHY

Business requirements change. Old events must still be readable.

## HOW

```typescript
function upcastEvent(event: Event): Event {
  if (event.type === 'MoneyDeposited' && event.version === 1) {
    // Add currency field if missing
    return {
      ...event,
      payload: { ...event.payload, currency: 'USD' },
      version: 2,
    };
  }
  return event;
}
```

Store event type and version. Apply upcasters during replay.
