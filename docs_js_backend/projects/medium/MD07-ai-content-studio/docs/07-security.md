# Security

## Prompt Injection Mitigation

The moderation middleware blocks common injection patterns:

- "Ignore previous instructions"
- "Disregard all prior"
- "You are now a ..."
- "DAN mode"
- "jailbreak"

For production, use OpenAI's Moderation API or a dedicated classifier model.

## Rate Limiting

Hourly token usage is aggregated from the database:

```sql
SELECT COALESCE(SUM(tokens_used), 0) as total 
FROM contents 
WHERE created_at > NOW() - INTERVAL '1 hour'
```

If `hourlyTokens + requestedTokens > HOURLY_TOKEN_LIMIT`, return `429 Too Many Requests`.

## Timeout

LLM streams abort after 30 seconds via `AbortController`. Without this, slow or hung streams consume resources indefinitely.

## Input Validation

- `max_tokens` clamped to 1–4096
- `temperature` clamped to 0–2
- Prompt length limited (Phase 3 enhancement)
