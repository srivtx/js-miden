# Troubleshooting

## Stream Hangs

**Symptom:** Client receives no data, connection stays open  
**Cause:** LLM stream has no timeout  
**Fix:** Ensure `AbortController` with 30s timeout wraps the OpenAI call. Compare with `streamCompletionNoTimeout` bug demo.

## High Token Costs

**Symptom:** Unexpected API bills  
**Cause:** No rate limiting on token usage  
**Fix:** Enable hourly token cap and per-user quotas.

## Prompt Injection Bypass

**Symptom:** Moderation misses novel injection patterns  
**Cause:** Regex-based filtering is brittle  
**Fix:** Use LLM-based moderation (OpenAI Moderation API) in addition to keyword filters.
