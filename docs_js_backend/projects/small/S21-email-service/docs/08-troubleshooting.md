# 08-troubleshooting.md

## Emails take 500ms+ to send

**Cause:** `sendEmail` calls `mockSmtpSend` synchronously.

**Fix:** Return 202 immediately, process queue in background.

## Bounced emails never retry

**Cause:** Status set to `bounced` permanently.

**Fix:** Increment `attempts`, re-queue if `< 3`, add exponential backoff.

## Template variables not replaced

**Cause:** Missing variable in template map.

**Fix:** Validate all `{{var}}` placeholders have matching keys.

## Queue status shows 0 queued

**Cause:** Synchronous send updates status before response.

**Fix:** Implement true async queue with background worker.
