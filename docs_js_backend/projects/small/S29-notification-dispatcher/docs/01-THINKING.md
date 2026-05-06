# 01-THINKING

## Mental Model
Notification dispatch is a fan-out problem with a guardrail (preferences). The guardrail is more important than the fan-out.

## Hot Path
1. API receives notify request.
2. Load user preferences.
3. Render template with variables.
4. For each allowed channel, call adapter.
5. Adapters send asynchronously.
6. Return aggregated result.

## Danger Zones
- **Preferences ignored**: The most common bug. Sending to opted-out channels is a compliance violation.
- **Template injection**: Unescaped variables become XSS or email injection.
- **Channel failures**: One slow channel (SMTP) should not block others.
- **Cost**: SMS is expensive. Sending blindly burns budget.
- **Duplicate suppression**: Same notification should not be sent twice due to retries.
