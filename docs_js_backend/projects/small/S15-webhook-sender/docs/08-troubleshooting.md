# Troubleshooting

## Webhooks Not Delivered

**Symptom:** Events queue but no HTTP calls reach receiver  
**Cause:** Worker not running or `sendWebhook` throwing unhandled errors  
**Fix:** Check logs, ensure `sendWebhook` catches all errors and updates status

## Infinite Retries

**Symptom:** Same webhook retried indefinitely  
**Cause:** Missing max retry limit  
**Fix:** Ensure `MAX_RETRIES` is enforced and final state is `failed`

## Signature Mismatch

**Symptom:** Receiver rejects valid webhooks  
**Cause:** Secret mismatch or payload serialization differences  
**Fix:** Use `JSON.stringify` without extra spaces; ensure both sides use same secret
